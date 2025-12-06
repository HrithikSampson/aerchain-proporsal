import { Server, Socket } from "socket.io";
import { RfpCoreBuilder, RfpCorePartial } from "../zod-schema/RfpProporsal";
import { RFP } from "../entity/RFP";
import { RfpItem } from "../entity/RfpItem";
import { v4 as uuid } from "uuid";
import AppDataSource from "../data-source";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import config from "../config/config";

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
      if (now - session.lastActivityAt.getTime() > SESSION_TTL_MS) {
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
  model: "embedding-001",
  apiKey: config.API_KEY,
});

async function generateConversationEmbedding(
  messages: MessageWithRole[]
): Promise<number[] | null> {
  try {
    const conversationText = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join(". ");
    const embedding = await embeddings.embedQuery(conversationText);
    return embedding;
  } catch (error) {
    console.warn("Failed to generate embedding (quota exceeded or API error), continuing without embedding:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function saveCompletedRfp(
  session: ProposalSession,
  _userId: string
): Promise<RFP | null> {
  try {
    const rfpCore = session.builder.build();

    const conversationEmbedding = await generateConversationEmbedding(session.messages);

    const rfpRepo = AppDataSource.getRepository(RFP);
    const rfpItemRepo = AppDataSource.getRepository(RfpItem);

    const rfp = rfpRepo.create({
      user_input: session.messages.map(m => `${m.role}: ${m.content}`).join(". "),
      embedding: conversationEmbedding || undefined,
      budgetAmount: rfpCore.budgetAmount.toString(),
      budgetCurrency: rfpCore.budgetCurrency,
      proporsalFinalisingEndDate: rfpCore.deliveryDays,
      extraItems: (rfpCore.extras || {}) as {[key: string]: string},
    });

    await rfpRepo.save(rfp);
    console.log(`Saved RFP with ID: ${rfp.id}`);

    if (rfpCore.rfpItems && rfpCore.rfpItems.length > 0) {
      const rfpItems = rfpCore.rfpItems.map(item => {
        const rfpItem = rfpItemRepo.create({
          description: item.description || item.name,
          quantity: item.quantity,
          specs: {
            name: item.name,
            unitPrice: item.unitPrice?.toString() || 'N/A',
            totalPrice: item.totalPrice?.toString() || 'N/A',
            ...(item.extras || {})
          },
          rfp: rfp,
        });
        return rfpItem;
      });

      await rfpItemRepo.save(rfpItems);
      console.log(`Saved ${rfpItems.length} items for RFP ${rfp.id}`);
    }

    return rfp;
  } catch (error) {
    console.error("Error saving RFP to database:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
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
      async (payload: { message?: string; roomId?: string }) => {
        const { message, roomId: providedRoomId } = payload;

        const rfpId = providedRoomId || uuid();

        let session = sessions.get(rfpId);
        const isNewSession = !session;

        if (isNewSession && message) {
          session = getOrCreateSession(rfpId, message);
        } else if (session) {
          console.log(`Reconnecting to existing session: ${rfpId}`);
        } else {
          socket.emit("proposal:error", {
            message: "Cannot join session: session does not exist and no initial message provided",
          });
          return;
        }

        session.sockets.add(socket.id);
        touchSession(rfpId);
        socket.join(rfpId);

        proposalNs.to(rfpId).emit("proposal:joined", {
          message: `Joined proposal session for RFP ${rfpId}`,
          rfpId,
        });

        console.log(`User joined proposal session for RFP ${rfpId}`);

        if (isNewSession && message) {
          try {
            const { ChainBuilder } = await import("./llm-interaction");

            const chain = new ChainBuilder(session.messages);
            const { response: llmResponse, nextQuestion } = await chain.interactLLM();

            session.builder.mergeFromLlm(llmResponse);
            session.partialState = session.builder.toState();

            console.log("Initial state after merge:", JSON.stringify(session.partialState, null, 2));
            console.log("Initial missing fields:", session.builder.getMissingRequiredFields());
            console.log("Initial is complete:", session.builder.isComplete());

            if (session.builder.isComplete()) {
              console.log("Initial RFP is complete, attempting to save...");
              const savedRfp = await saveCompletedRfp(session, "initial-user");

              if (savedRfp) {
                console.log("Initial RFP saved successfully, emitting completion event");
                proposalNs.to(rfpId).emit("proposal:complete", {
                  message: "Your RFP has been completed and saved!",
                  rfp: savedRfp,
                  rfpCore: session.builder.build(),
                });

                removeSession(rfpId, io);
              } else {
                console.log("Failed to save initial RFP, emitting error");
                proposalNs.to(rfpId).emit("proposal:error", {
                  message: "Failed to save the RFP. Please try again.",
                });
              }
            } else if (nextQuestion) {
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
        } else if (!isNewSession && session) {
          if (session.messages.length > 0) {
            const lastMessage = session.messages[session.messages.length - 1];
            if (lastMessage.role === "llm") {
              proposalNs.to(socket.id).emit("proposal:question", {
                question: lastMessage.content,
                currentState: session.partialState,
                missingFields: session.builder.getMissingRequiredFields(),
              });
            }
          }
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

          console.log("Current state after merge:", JSON.stringify(session.partialState, null, 2));
          console.log("Missing fields:", session.builder.getMissingRequiredFields());
          console.log("Is complete:", session.builder.isComplete());

          if (session.builder.isComplete()) {
            console.log("RFP is complete, attempting to save...");
            const savedRfp = await saveCompletedRfp(session, userId);

            if (savedRfp) {
              console.log("RFP saved successfully, emitting completion event");
              proposalNs.to(rfpId).emit("proposal:complete", {
                message: "Your RFP has been completed and saved!",
                rfp: savedRfp,
                rfpCore: session.builder.build(),
              });

              removeSession(rfpId, io);
            } else {
              console.log("Failed to save RFP, emitting error");
              proposalNs.to(rfpId).emit("proposal:error", {
                message: "Failed to save the RFP. Please try again.",
              });
            }
          } else if (nextQuestion) {
            session.messages.push({ role: "llm", content: nextQuestion });

            proposalNs.to(rfpId).emit("proposal:question", {
              question: nextQuestion,
              currentState: session.partialState,
              missingFields: session.builder.getMissingRequiredFields(),
            });
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

