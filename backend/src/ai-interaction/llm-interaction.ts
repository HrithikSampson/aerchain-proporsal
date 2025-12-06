import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { RfpCoreBuilder, RfpCorePartial } from "../zod-schema/RfpProporsal";
import config from "../config/config";
const rfpParser = new JsonOutputParser<RfpCorePartial>();

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  temperature: 0.1,
  apiKey: config.API_KEY,
  maxRetries: 2,
});

type PromptPair = [string, string];

const SYSTEM_INSTRUCTIONS = `You are an RFP proposal creation assistant. Your goal is to extract and build a complete RFP proposal from the user's conversation.

The proposal must include:
- budgetAmount: Total budget (number)
- budgetCurrency: Currency code (e.g., USD, EUR, INR)
- deliveryDays: Expected delivery time in days (integer)
- warrantyMonths: Warranty period in months (optional, can be null)
- paymentTerms: Payment terms description (optional)
- rfpItems: Array of items, each with:
  - name: Item name (string)
  - description: Item description (optional)
  - quantity: Number of units (integer)
  - unitPrice: Price per unit (optional, can be null)
  - totalPrice: Total price for all units (optional, can be null)
  - extras: Additional metadata (optional)
- extras: Additional metadata for the proposal (optional)

Based on the conversation history, extract as much information as possible. Return ONLY a JSON object with the fields you can confidently extract. Do not make up information. If a field is missing and required, leave it out or set it to null/undefined.

IMPORTANT: Always return valid JSON that can be parsed. Do not include any explanatory text outside the JSON.`;

export class ChainBuilder {
  private prompts: PromptPair[];

  constructor(conversationHistory?: { role: "user" | "llm"; content: string }[]) {
    this.prompts = [];

    if (conversationHistory && conversationHistory.length > 0) {
      let firstMessage = SYSTEM_INSTRUCTIONS + "\n\nUser: " + conversationHistory[0].content;
      this.prompts.push(["human", firstMessage]);

      for (let i = 1; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        if (msg.role === "user") {
          this.prompts.push(["human", msg.content]);
        } else {
          this.prompts.push(["ai", msg.content]);
        }
      }
    }
  }

  addChain(items: PromptPair[]): void {
    this.prompts.push(...items);
  }

  async interactLLM(
    userMessage?: string
  ): Promise<{ response: RfpCorePartial; nextQuestion: string | null }> {
    if (userMessage) {
      this.prompts.push(["human", userMessage]);
    }

    if (this.prompts.length === 0 && userMessage) {
      const firstMessage = SYSTEM_INSTRUCTIONS + "\n\nUser: " + userMessage;
      this.prompts = [["human", firstMessage]];
    }

    try {
      console.log("Calling Gemini API with prompts:", this.prompts.length);

      const chain = ChatPromptTemplate
        .fromMessages(this.prompts)
        .pipe(model)
        .pipe(rfpParser);

      const result = await chain.invoke({});
      console.log("Gemini API response received:", result);

      const builder = new RfpCoreBuilder(result);
      const missingFields = builder.getMissingRequiredFields();

      let nextQuestion: string | null = null;
      if (missingFields.length > 0) {
        const field = missingFields[0];
        nextQuestion = `Please provide: ${String(field).replace(/([A-Z])/g, ' $1').toLowerCase()}`;
      }

      return { response: result, nextQuestion };
    } catch (error) {
      console.error("LLM Interaction Error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  }
}