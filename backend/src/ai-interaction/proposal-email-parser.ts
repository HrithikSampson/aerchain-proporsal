import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { RfpProposalBuilder, RfpProposalPartial } from "../zod-schema/RfpProporsal";
import config from "../config/config";

const proposalParser = new JsonOutputParser<RfpProposalPartial>();

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.1,
  apiKey: config.API_KEY,
  maxRetries: 2,
});

const SYSTEM_INSTRUCTIONS = `You are a vendor proposal email parser. Your goal is to extract pricing and item details from vendor emails responding to RFPs.

The proposal must include:
- budgetAmount: Total quoted price (number)
- budgetCurrency: Currency code (e.g., USD, EUR, INR)
- items: Array of quoted items, each with:
  - name: Item name (string)
  - quantity: Number of units (integer)
  - unitPrice: Price per unit (number)
  - totalPrice: Total price for all units (number)
  - specs: Additional specifications (optional)
- notes: Additional vendor notes or terms (optional)
- extraItems: Additional metadata (optional)

Extract all relevant information from the email. Return ONLY valid JSON. Do not include explanatory text outside the JSON.`;

export async function parseVendorProposalEmail(
  emailContent: string
): Promise<{ proposalData: RfpProposalPartial; isComplete: boolean; missingFields: string[] }> {
  try {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_INSTRUCTIONS],
      ["human", `Extract the vendor proposal details from this email:\n\n${emailContent}`],
    ]);

    const chain = prompt.pipe(model).pipe(proposalParser);
    const result = await chain.invoke({});

    const builder = new RfpProposalBuilder(result);
    const missingFields = builder.getMissingRequiredFields();
    const isComplete = builder.isComplete();

    return {
      proposalData: result,
      isComplete,
      missingFields,
    };
  } catch (error) {
    console.error("Error parsing vendor proposal email:", error);
    throw error;
  }
}
