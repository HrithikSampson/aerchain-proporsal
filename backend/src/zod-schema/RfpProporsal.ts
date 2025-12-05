import { z } from "zod";

export const RfpItemSchema = z
  .object({
    name: z
      .string()
      .describe("Short name of the requested item, e.g. 'Laptop', 'Router', 'Printer Ink'."),
    
    description: z
      .string()
      .nullable()
      .optional()
      .describe("Detailed description/specification of the item (optional)."),
    
    quantity: z
      .number()
      .int()
      .describe("How many units of this item are required (whole number)."),
    
    unitPrice: z
      .number()
      .nullable()
      .optional()
      .describe("Price per unit if known, otherwise null."),
    
    totalPrice: z
      .number()
      .nullable()
      .optional()
      .describe("Total price for all units (quantity X unitPrice) if known, otherwise null."),
    extras: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Additional arbitrary key-value metadata for this item, not covered by other fields."),
  })
  .describe("A single requested item in the RFP, including name, details, quantity, and pricing.");

export const RfpCoreFullSchema = z
  .object({
    budgetAmount: z
      .number()
      .describe("Total budget amount for the RFP in numeric form (no commas)."),

    budgetCurrency: z
      .string()
      .describe("ISO currency code like 'USD', 'EUR', 'INR'."),

    deliveryDays: z
      .number()
      .int()
      .describe("Expected delivery time in whole days from the date of order."),

    warrantyMonths: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe("Warranty period in months, or null if no warranty is offered."),

    paymentTerms: z
      .string()
      .nullable()
      .optional()
      .describe("Payment terms, e.g. '50% advance, 50% on delivery'."),

    rfpItems: z
      .array(RfpItemSchema)
      .min(1, "At least one item must be provided in the RFP.")
      .transform((arr) => (arr && arr.length === 0 ? undefined : arr))
      .describe("List of individual items requested in the RFP, each with name, quantity, and optional pricing."),

    extras: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Additional arbitrary key-value metadata for this proporsal, not covered by other fields."),
  })
  .describe("Core commercial details of an RFP, including budget, delivery, and list of requested items.");


export type RfpCore = z.infer<typeof RfpCoreFullSchema>;

export const RfpCorePartialSchema = RfpCoreFullSchema.partial();
export type RfpCorePartial = z.infer<typeof RfpCorePartialSchema>;

export class RfpCoreBuilder {
  private state: RfpCorePartial = {};

  static fromState(state: RfpCorePartial = {}): RfpCoreBuilder {
    const b = new RfpCoreBuilder();
    b.state = { ...state };
    return b;
  }

  mergeFromLlm(partial: RfpCorePartial): this {
    this.state = {
      ...this.state,
      ...Object.fromEntries(
        Object.entries(partial).filter(
          ([key, value]) => value != null && this.state[key as keyof RfpCorePartial] == null
        )
      ),
    };
    return this;
  }



  mergeFromUser(partial: RfpCorePartial): this {
    this.state = { ...this.state, ...partial };
    return this;
  }

  getMissingRequiredFields(): (keyof RfpCore)[] {
    return this.getMissingRequiredFieldsFromZod(this.state);
  }

  isComplete(): boolean {
    return this.getMissingRequiredFields().length === 0;
  }

  toState(): RfpCorePartial {
    return { ...this.state };
  }

  build(): RfpCore {
    if(!this.isComplete()) {
      throw new Error("Cannot build RfpCore: missing required fields: " + this.getMissingRequiredFields().join(", "));
    }
    const result = RfpCoreFullSchema.safeParse(this.state);
    if (!result.success) {
      throw new Error(
        "Cannot build RfpCore: \n" + JSON.stringify(result.error)
      );
    }
    return result.data;
  }

  private getMissingRequiredFieldsFromZod<T extends object>(state: T): (keyof T)[] {
    const shape = (RfpCoreFullSchema as z.ZodObject<any>).shape;
    const missing: (keyof T)[] = [];
    for (const key in shape) {
        const schema = shape[key];
        if (
            !(schema.isOptional() || (schema.isNullable() && schema.isOptional()))
        ) {
            if (state[key as keyof T] == null) {
                missing.push(key as keyof T);
            }
        }
    }
    return missing;
  }
}

