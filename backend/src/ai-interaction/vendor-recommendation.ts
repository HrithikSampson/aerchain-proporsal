import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import config from "../config/config";

interface ProposalForComparison {
  vendorEmail: string;
  budgetAmount: string;
  budgetCurrency: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  notes: string | null;
  createdAt: string;
}

interface RfpForComparison {
  user_input: string;
  budgetAmount: string;
  budgetCurrency: string;
  items?: {
    itemName?: string;
    name?: string;
    quantity: number;
    category?: string;
  }[];
}

interface VendorScore {
  vendorEmail: string;
  score: number;
  priceScore: number;
  completenessScore: number;
  termsScore: number;
  strengths: string[];
  weaknesses: string[];
}

interface RecommendationResult {
  recommendedVendor: string;
  reasoning: string;
  comparison: VendorScore[];
  summary: string;
}

const outputParser = new JsonOutputParser<RecommendationResult>();

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.3,
  apiKey: config.API_KEY,
  maxRetries: 2,
});

const SYSTEM_INSTRUCTIONS = `You are a procurement expert AI that analyzes vendor proposals and provides recommendations.

Your task is to:
1. Compare multiple vendor proposals for an RFP
2. Score each vendor on price competitiveness, completeness, and terms
3. Identify strengths and weaknesses for each vendor
4. Recommend the best vendor with clear reasoning

Scoring criteria (0-100):
- priceScore: How competitive is the price? (lower is better, but within reason)
- completenessScore: Did they provide all requested items? Complete information?
- termsScore: Payment terms, delivery time, warranty, and other conditions

Consider:
- Budget constraints from the RFP
- Item requirements and specifications
- Overall value (not just lowest price)
- Risk factors (incomplete proposals, unclear terms)
- Vendor notes and conditions

Return a JSON object with:
{{
  "recommendedVendor": "email of best vendor",
  "reasoning": "2-3 sentences explaining why this vendor is recommended",
  "comparison": [
    {{
      "vendorEmail": "vendor@example.com",
      "score": 85,
      "priceScore": 90,
      "completenessScore": 85,
      "termsScore": 80,
      "strengths": ["Competitive pricing", "Fast delivery"],
      "weaknesses": ["No warranty mentioned"]
    }}
  ],
  "summary": "Brief overall summary of all proposals"
}}`;

export async function generateVendorRecommendation(
  rfp: RfpForComparison,
  proposals: ProposalForComparison[]
): Promise<RecommendationResult> {
  if (proposals.length === 0) {
    throw new Error("No proposals to compare");
  }

  const rfpItemsText = rfp.items && rfp.items.length > 0
    ? `- Required Items:\n${rfp.items.map(item => {
        const name = item.itemName || item.name;
        const category = item.category ? ` (${item.category})` : '';
        return `  • ${name}: ${item.quantity} units${category}`;
      }).join('\n')}`
    : '';

  const rfpContext = `
    RFP Requirements:
    - Description: ${rfp.user_input}
    - Budget: ${rfp.budgetCurrency} ${rfp.budgetAmount}
    ${rfpItemsText}
  `;

  const proposalsContext = proposals.map((p, idx) => {
    const itemsList = p.items.map(item =>
      `  • ${item.name}: ${item.quantity} units @ ${p.budgetCurrency} ${item.unitPrice} each = ${p.budgetCurrency} ${item.totalPrice}`
    ).join('\n');

    const notesText = p.notes ? `- Additional Notes: ${p.notes}` : '- No additional notes';

    return `
      Vendor ${idx + 1}: ${p.vendorEmail}
      - Total Quote: ${p.budgetCurrency} ${p.budgetAmount}
      - Submitted: ${new Date(p.createdAt).toLocaleDateString()}
      - Items Quoted:
      ${itemsList}
      ${notesText}
    `;
  }).join('\n---\n');

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_INSTRUCTIONS],
    ["human", `${rfpContext}\n\nVendor Proposals:\n${proposalsContext}\n\nAnalyze these proposals and recommend the best vendor.`],
  ]);

  try {
    const chain = prompt.pipe(model).pipe(outputParser);
    const result = await chain.invoke({});

    const overallScores = result.comparison.map(v => ({
      ...v,
      score: Math.round((v.priceScore + v.completenessScore + v.termsScore) / 3)
    }));

    return {
      ...result,
      comparison: overallScores.sort((a, b) => b.score - a.score)
    };
  } catch (error) {
    console.error("Error generating vendor recommendation:", error);
    throw error;
  }
}

export async function generateProposalComparison(
  rfp: RfpForComparison,
  proposals: ProposalForComparison[]
): Promise<{
  highestPrice: string;
  lowestPrice: string;
  averagePrice: number;
  priceRange: number;
  totalProposals: number;
  insights: string[];
}> {
  const prices = proposals.map(p => parseFloat(p.budgetAmount));
  const highestPrice = Math.max(...prices);
  const lowestPrice = Math.min(...prices);
  const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const priceRange = highestPrice - lowestPrice;

  const insights: string[] = [];

  const rfpBudget = parseFloat(rfp.budgetAmount);
  const withinBudget = proposals.filter(p => parseFloat(p.budgetAmount) <= rfpBudget);

  if (withinBudget.length > 0) {
    insights.push(`${withinBudget.length} of ${proposals.length} proposals are within budget`);
  } else {
    insights.push(`All proposals exceed the budget of ${rfp.budgetCurrency} ${rfp.budgetAmount}`);
  }

  if (priceRange / lowestPrice > 0.2) {
    insights.push(`Significant price variation: ${((priceRange / lowestPrice) * 100).toFixed(1)}% difference between highest and lowest`);
  } else {
    insights.push(`Prices are relatively consistent across vendors`);
  }

  const completeProposals = proposals.filter(p =>
    p.items.length > 0 &&
    p.items.every(item => item.unitPrice > 0 && item.totalPrice > 0)
  );

  if (completeProposals.length < proposals.length) {
    insights.push(`${proposals.length - completeProposals.length} proposal(s) have incomplete item details`);
  }

  return {
    highestPrice: `${proposals[0].budgetCurrency} ${highestPrice.toLocaleString()}`,
    lowestPrice: `${proposals[0].budgetCurrency} ${lowestPrice.toLocaleString()}`,
    averagePrice: parseFloat(averagePrice.toFixed(2)),
    priceRange: parseFloat(priceRange.toFixed(2)),
    totalProposals: proposals.length,
    insights
  };
}
