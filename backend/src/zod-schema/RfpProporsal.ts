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

export type RfpItem = z.infer<typeof RfpItemSchema>;
export type RfpItemPartial = Partial<RfpItem>;

export type RfpCore = z.infer<typeof RfpCoreFullSchema>;
export const RfpCorePartialSchema = RfpCoreFullSchema.partial();
export type RfpCorePartial = z.infer<typeof RfpCorePartialSchema>;

type BuilderFull<TSchema extends z.ZodTypeAny> = z.infer<TSchema>;
type BuilderPartial<TSchema extends z.ZodTypeAny> = Partial<BuilderFull<TSchema>>;

class RFPBuilder<TSchema extends z.ZodObject<any>> {
  private state: BuilderPartial<TSchema> = {};

  constructor(private readonly schema: TSchema, initial: BuilderPartial<TSchema> = {}) {
    this.state = { ...initial };
  }

  static fromState<TSchema extends z.ZodObject<any>>(
    schema: TSchema,
    state: BuilderPartial<TSchema> = {}
  ): RFPBuilder<TSchema> {
    return new RFPBuilder(schema, state);
  }

  mergeFromLlm(partial: BuilderPartial<TSchema>): this {
    const mergedItems = Array.isArray(partial.rfpItems ?? undefined)
      ? (partial.rfpItems as typeof RfpItemSchema[]).map((item) =>
        RfpItemBuilder.fromState(RfpItemSchema, item)
        .mergeFromLlm(item)
        .toState()
      )
      : this.state.rfpItems;

    this.state = {
      ...this.state,
      ...Object.fromEntries(
        Object.entries(partial).filter(
          ([key, value]) =>
          key !== "rfpItems" &&
          value != null &&
          this.state[key as keyof BuilderPartial<TSchema>] == null &&
          !Array.isArray(value)
        )
      ),
      rfpItems: mergedItems,
    };
    return this;
  }

  mergeFromUser(partial: BuilderPartial<TSchema>): this {
    this.state = { ...this.state, ...partial };
    return this;
  }

  getMissingRequiredFields(): (keyof BuilderFull<TSchema>)[] {
    return this.getMissingRequiredFieldsFromZod(this.state);
  }

  isComplete(): boolean {
    return this.getMissingRequiredFields().length === 0;
  }

  toState(): BuilderPartial<TSchema> {
    return { ...this.state };
  }

  build(): BuilderFull<TSchema> {
    if (!this.isComplete()) {
      const missingFields = this.getMissingRequiredFields();
      throw new Error(
        "Cannot build: missing required fields: " + missingFields.join(", ")
      );
    }
    const result = this.schema.safeParse(this.state);
    if (!result.success) {
      throw new Error(
        "Cannot build: \n" + JSON.stringify(result.error, null, 2)
      );
    }
    return result.data;
  }

  private getMissingRequiredFieldsFromZod(
    state: BuilderPartial<TSchema>
  ): (keyof BuilderFull<TSchema>)[] {
    const shape = this.schema.shape;
    const missing: (keyof BuilderFull<TSchema>)[] = [];
    for (const key in shape) {
      const fieldSchema: any = shape[key];

      if (key === "rfpItems") {
        if (!Array.isArray(state.rfpItems) || state.rfpItems.length === 0) {
          missing.push(key as keyof BuilderFull<TSchema>);
          continue;
        }

        for (let i = 0; i < state.rfpItems.length; i++) {
          const item = state.rfpItems[i];
          const itemBuilder = RfpItemBuilder.fromState(RfpItemSchema, item);
          const itemMissingFields = itemBuilder.getMissingRequiredFields();
          if (itemMissingFields.length > 0) {
            missing.push(...itemMissingFields.map(f => `rfpItems.${i}.${String(f)}` as keyof BuilderFull<TSchema>));
          }
        }
        continue;
      }

      const isOptional =
        typeof fieldSchema.isOptional === "function" &&
        fieldSchema.isOptional();
      const isNullable =
        typeof fieldSchema.isNullable === "function" &&
        fieldSchema.isNullable();
      if (!(isOptional || (isNullable && isOptional))) {
        const value = (state as any)[key];
        if (value == null) {
          missing.push(key as keyof BuilderFull<TSchema>);
        }
      }
    }
    return missing;
  }
}

export class RfpCoreBuilder extends RFPBuilder<typeof RfpCoreFullSchema> {
  constructor(initial: RfpCorePartial = {}) {
    super(RfpCoreFullSchema, initial);
  }
}

export class RfpItemBuilder extends RFPBuilder<typeof RfpItemSchema> {
  constructor(initial: RfpItemPartial = {}) {
    super(RfpItemSchema, initial);
  }
}

export const RfpProposalItemSchema = z
  .object({
    name: z
      .string()
      .describe("Name of the item being quoted"),

    quantity: z
      .number()
      .int()
      .describe("Quantity of items being offered"),

    unitPrice: z
      .number()
      .describe("Price per unit offered by vendor"),

    totalPrice: z
      .number()
      .describe("Total price for all units (quantity × unitPrice)"),

    specs: z
      .record(z.string(), z.string())
      .optional()
      .describe("Additional specifications or details about the item"),
  })
  .describe("A single item in the vendor's proposal with pricing");

export const RfpProposalFullSchema = z
  .object({
    budgetAmount: z
      .number()
      .describe("Total budget/quote amount from the vendor"),

    budgetCurrency: z
      .string()
      .describe("Currency code like 'USD', 'EUR', 'INR'"),

    items: z
      .array(RfpProposalItemSchema)
      .min(1, "At least one item must be provided in the proposal")
      .describe("List of items the vendor is quoting for"),

    notes: z
      .string()
      .nullable()
      .optional()
      .describe("Additional notes or terms from the vendor"),

    extraItems: z
      .record(z.string(), z.string())
      .optional()
      .describe("Additional metadata for this proposal"),
  })
  .describe("Vendor's proposal/quote in response to an RFP");

export type RfpProposalItem = z.infer<typeof RfpProposalItemSchema>;
export type RfpProposalItemPartial = Partial<RfpProposalItem>;

export type RfpProposalFull = z.infer<typeof RfpProposalFullSchema>;
export const RfpProposalPartialSchema = RfpProposalFullSchema.partial();
export type RfpProposalPartial = z.infer<typeof RfpProposalPartialSchema>;

export class RfpProposalBuilder extends RFPBuilder<typeof RfpProposalFullSchema> {
  constructor(initial: RfpProposalPartial = {}) {
    super(RfpProposalFullSchema, initial);
  }
}

export class RfpProposalItemBuilder extends RFPBuilder<typeof RfpProposalItemSchema> {
  constructor(initial: RfpProposalItemPartial = {}) {
    super(RfpProposalItemSchema, initial);
  }
}
