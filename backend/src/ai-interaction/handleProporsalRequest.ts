import { Server, Socket } from "socket.io";
import { RfpCoreBuilder, RfpCorePartial } from "../zod-schema/RfpProporsal";
import { RFP } from "../entity/RFP";
import { RfpProposal } from "../entity/RfpProporsal";
import { v4 as uuid } from "uuid";
import AppDataSource from "../data-source";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

type MessageWithRole = {
  role: "user" | "llm";
  content: string;
};

type ProposalSession = {
  rfpId: string;
  messages: MessageWithRole[];
  partialState: RfpCorePartial;
  builder: RfpCoreBuilder;
  lastActivityAt: Date;
  sockets: Set<string>;
};

const sessions = new Map<string, ProposalSession>();

const SESSION_TTL_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

function getOrCreateSession(
  rfpId: string,
  message: string
): ProposalSession {
  let session = sessions.get(rfpId);
  if (!session) {
    const builder = new RfpCoreBuilder({});
    session = {
      messages: [{ role: "user", content: message }],
      partialState: builder.toState(),
      builder,
      lastActivityAt: new Date(),
      rfpId,
      sockets: new Set<string>(),
    };
    sessions.set(rfpId, session);
  } else {
    session.messages.push({ role: "user", content: message });
  }
  return session;
}

function touchSession(roomId: string): void {
  const s = sessions.get(roomId);
  if (s) s.lastActivityAt = new Date();
}

function removeSession(roomId: string, io: Server): void {
  const s = sessions.get(roomId);
  if (!s) return;

  const socketIds = Array.from(s.sockets);
  for (const socketId of socketIds) {
    const socket = io.of("/proposal").sockets.get(socketId);
    if (socket) {
      socket.leave(roomId);
    }
  }

  sessions.delete(roomId);
}

function startSessionCleanup(io: Server): void {
  setInterval(() => {
    const now = Date.now();
    const sessionEntries = Array.from(sessions.entries());
    for (const [roomId, session] of sessionEntries) {
      if (now - session.lastActivityAt.getMilliseconds() > SESSION_TTL_MS) {
        const proposalNs = io.of("/proposal");
        proposalNs.to(roomId).emit("proposal:end", {
          reason: "Session expired due to inactivity.",
        });
        removeSession(roomId, io);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});

async function generateConversationEmbedding(
  messages: MessageWithRole[]
): Promise<number[]> {
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join(". ");
  const embedding = await embeddings.embedQuery(conversationText);
  return embedding;
}

async function saveCompletedProposal(
  session: ProposalSession,
  userId: string
): Promise<RfpProposal | null> {
  try {
    const rfpCore = session.builder.build();

    const conversationEmbedding = await generateConversationEmbedding(session.messages);

    const rfpRepo = AppDataSource.getRepository(RFP);
    const rfp = rfpRepo.create({
      user_input: session.messages.map(m => `${m.role}: ${m.content}`).join(". "),
      embedding: conversationEmbedding,
      budgetAmount: rfpCore.budgetAmount.toString(),
      budgetCurrency: rfpCore.budgetCurrency,
      proporsalFinalisingEndDate: rfpCore.deliveryDays,
      extraItems: (rfpCore.extras || {}) as {[key: string]: string},
    });
    await rfpRepo.save(rfp);

    const proposalRepo = AppDataSource.getRepository(RfpProposal);
    const proposal = new RfpProposal();
    proposal.budgetAmount = rfpCore.budgetAmount.toString();
    proposal.budgetCurrency = rfpCore.budgetCurrency;
    proposal.items = rfpCore.rfpItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: item.totalPrice || 0,
      specs: (item.extras || {}) as Record<string, string>,
    }));
    proposal.rfp = rfp;
    proposal.extraItems = (rfpCore.extras || {}) as Record<string, string>;
    proposal.notes = `Warranty: ${rfpCore.warrantyMonths || 0} months. Payment Terms: ${rfpCore.paymentTerms || "N/A"}`;
    await proposalRepo.save(proposal);

    return proposal;
  } catch (error) {
    console.error("Error saving completed proposal:", error);
    return null;
  }
}


export function getActiveRooms(): Array<{
  rfpId: string;
  lastActivityAt: Date;
  participantCount: number;
}> {
  return Array.from(sessions.entries()).map(([rfpId, session]) => ({
    rfpId,
    lastActivityAt: session.lastActivityAt,
    participantCount: session.sockets.size,
  }));
}

export function setupProposalHandlers(io: Server): void {
  const proposalNs = io.of("/proposal");

  startSessionCleanup(io);

  proposalNs.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(
      "proposal:join",
      async (payload: { message: string }) => {
        const { message } = payload;
        const rfpId = uuid();
        const session = getOrCreateSession(rfpId, message);
        session.sockets.add(socket.id);
        touchSession(rfpId);

        socket.join(rfpId);

        proposalNs.to(rfpId).emit("proposal:joined", {
          message: `Joined proposal session for RFP ${rfpId}`,
          rfpId,
        });

        console.log(`User joined proposal session for RFP ${rfpId}`);

        try {
          const { ChainBuilder } = await import("./llm-interaction");

          const chain = new ChainBuilder(session.messages);
          const { response: llmResponse, nextQuestion } = await chain.interactLLM();

          session.builder.mergeFromLlm(llmResponse);
          session.partialState = session.builder.toState();

          if (nextQuestion) {
            session.messages.push({ role: "llm", content: nextQuestion });

            proposalNs.to(rfpId).emit("proposal:question", {
              question: nextQuestion,
              currentState: session.partialState,
              missingFields: session.builder.getMissingRequiredFields(),
            });
          }
        } catch (error) {
          console.error("Error processing initial message:", error);
          proposalNs.to(rfpId).emit("proposal:error", {
            message: "An error occurred while starting the proposal session.",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    socket.on(
      "proposal:answer",
      async (payload: { rfpId: string; userId: string; answer: string }) => {
        const { rfpId, userId, answer } = payload;

        const session = sessions.get(rfpId);
        if (!session) {
          socket.emit("proposal:end", { reason: "Session expired." });
          return;
        }

        touchSession(rfpId);

        try {
          session.messages.push({ role: "user", content: answer });

          const { ChainBuilder } = await import("./llm-interaction");

          const chain = new ChainBuilder(session.messages);

          const { response: llmResponse, nextQuestion } = await chain.interactLLM();

          session.builder.mergeFromLlm(llmResponse);
          session.partialState = session.builder.toState();

          if (nextQuestion) {
            session.messages.push({ role: "llm", content: nextQuestion });

            proposalNs.to(rfpId).emit("proposal:question", {
              question: nextQuestion,
              currentState: session.partialState,
              missingFields: session.builder.getMissingRequiredFields(),
            });
          }

          if (session.builder.isComplete()) {
            const savedProposal = await saveCompletedProposal(session, userId);

            if (savedProposal) {
              proposalNs.to(rfpId).emit("proposal:complete", {
                message: "Your RFP proposal has been completed and saved!",
                proposal: savedProposal,
                rfpCore: session.builder.build(),
              });

              removeSession(rfpId, io);
            } else {
              proposalNs.to(rfpId).emit("proposal:error", {
                message: "Failed to save the proposal. Please try again.",
              });
            }
          }
        } catch (error) {
          console.error("Error processing answer:", error);
          proposalNs.to(rfpId).emit("proposal:error", {
            message: "An error occurred while processing your answer. Please try again.",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const sessionEntries = Array.from(sessions.entries());
      for (const [roomId, session] of sessionEntries) {
        if (session.sockets.has(socket.id)) {
          session.sockets.delete(socket.id);
          touchSession(roomId);
        }
      }
    });
  });
}


