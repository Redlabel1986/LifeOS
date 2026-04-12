// ============================================================================
// apps/api — shared primitives
// ----------------------------------------------------------------------------
// Money object type, pagination inputs, DateRange — reused across every
// resource file. Defined once here to avoid drift.
// ============================================================================

import { builder } from "./builder.js";

export interface MoneyShape {
  amountMinor: bigint | string;
  currency: string;
}

export const MoneyRef = builder.objectRef<MoneyShape>("Money").implement({
  description:
    "Money amount in minor units. amountMinor is always positive; direction is encoded by the enclosing entity.",
  fields: (t) => ({
    amountMinor: t.field({
      type: "BigInt",
      resolve: (parent) => String(parent.amountMinor),
    }),
    currency: t.exposeString("currency"),
  }),
});

export const MoneyInput = builder.inputType("MoneyInput", {
  fields: (t) => ({
    amountMinor: t.field({ type: "BigInt", required: true }),
    currency: t.string({ required: true }),
  }),
});

export const PageInput = builder.inputType("PageInput", {
  fields: (t) => ({
    limit: t.int({ required: false, defaultValue: 25 }),
    offset: t.int({ required: false, defaultValue: 0 }),
  }),
});

export const DateRangeInput = builder.inputType("DateRangeInput", {
  fields: (t) => ({
    from: t.field({ type: "DateTime", required: true }),
    to: t.field({ type: "DateTime", required: true }),
  }),
});

export interface PageInfoShape {
  totalCount: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export const PageInfoRef = builder
  .objectRef<PageInfoShape>("PageInfo")
  .implement({
    fields: (t) => ({
      totalCount: t.exposeInt("totalCount"),
      hasMore: t.exposeBoolean("hasMore"),
      limit: t.exposeInt("limit"),
      offset: t.exposeInt("offset"),
    }),
  });

export interface DateRangeShape {
  from: Date;
  to: Date;
}

export const DateRangeRef = builder
  .objectRef<DateRangeShape>("DateRange")
  .implement({
    fields: (t) => ({
      from: t.field({
        type: "DateTime",
        resolve: (p) => p.from.toISOString(),
      }),
      to: t.field({
        type: "DateTime",
        resolve: (p) => p.to.toISOString(),
      }),
    }),
  });

/** Clamp pagination input to safe bounds. */
export const normalizePage = (input?: {
  limit?: number | null;
  offset?: number | null;
} | null): { limit: number; offset: number } => {
  const limit = Math.min(Math.max(input?.limit ?? 25, 1), 100);
  const offset = Math.max(input?.offset ?? 0, 0);
  return { limit, offset };
};
