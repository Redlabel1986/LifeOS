// ============================================================================
// apps/api — Budget type + queries + mutations
// ----------------------------------------------------------------------------
// Budgets compute `spent`, `remaining` and `progress` on-the-fly from
// transactions in the budget period. `categoryId=null` = overall budget.
// ============================================================================

import { TransactionType } from "@lifeos/db";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import { DateRangeInput, MoneyInput, MoneyRef } from "./shared.js";

const sumExpenses = async (
  prisma: import("@lifeos/db").PrismaClient,
  userId: string,
  categoryId: string | null,
  from: Date,
  to: Date,
  currency: string,
): Promise<bigint> => {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      currency,
      categoryId: categoryId ?? undefined,
      occurredAt: { gte: from, lt: to },
    },
    select: { amountMinor: true },
  });
  return rows.reduce((acc, r) => acc + r.amountMinor, 0n);
};

builder.prismaObject("Budget", {
  fields: (t) => ({
    id: t.exposeID("id"),
    category: t.relation("category", { nullable: true }),
    money: t.field({
      type: MoneyRef,
      resolve: (b) => ({ amountMinor: b.amountMinor, currency: b.currency }),
    }),
    periodStart: t.field({
      type: "DateTime",
      resolve: (b) => b.periodStart.toISOString(),
    }),
    periodEnd: t.field({
      type: "DateTime",
      resolve: (b) => b.periodEnd.toISOString(),
    }),
    rollover: t.exposeBoolean("rollover"),
    spent: t.field({
      type: MoneyRef,
      resolve: async (b, _args, ctx) => {
        const spent = await sumExpenses(
          ctx.prisma,
          b.userId,
          b.categoryId,
          b.periodStart,
          b.periodEnd,
          b.currency,
        );
        return { amountMinor: spent, currency: b.currency };
      },
    }),
    remaining: t.field({
      type: MoneyRef,
      resolve: async (b, _args, ctx) => {
        const spent = await sumExpenses(
          ctx.prisma,
          b.userId,
          b.categoryId,
          b.periodStart,
          b.periodEnd,
          b.currency,
        );
        return { amountMinor: b.amountMinor - spent, currency: b.currency };
      },
    }),
    progress: t.float({
      resolve: async (b, _args, ctx) => {
        const spent = await sumExpenses(
          ctx.prisma,
          b.userId,
          b.categoryId,
          b.periodStart,
          b.periodEnd,
          b.currency,
        );
        if (b.amountMinor === 0n) return 0;
        return Number(spent) / Number(b.amountMinor);
      },
    }),
  }),
});

// --- Inputs -----------------------------------------------------------------

const SetBudgetInput = builder.inputType("SetBudgetInput", {
  fields: (t) => ({
    categoryId: t.id({ required: false }),
    money: t.field({ type: MoneyInput, required: true }),
    periodStart: t.field({ type: "DateTime", required: true }),
    periodEnd: t.field({ type: "DateTime", required: true }),
    rollover: t.boolean({ required: false }),
  }),
});

interface BudgetPayloadShape {
  budgetId: string;
}

const BudgetPayloadRef = builder
  .objectRef<BudgetPayloadShape>("BudgetPayload")
  .implement({
    fields: (t) => ({
      budget: t.prismaField({
        type: "Budget",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.budget.findUniqueOrThrow({
            ...query,
            where: { id: parent.budgetId },
          }),
      }),
    }),
  });

// --- Queries ----------------------------------------------------------------

builder.queryField("budgets", (t) =>
  t.prismaField({
    type: ["Budget"],
    args: { period: t.arg({ type: DateRangeInput, required: false }) },
    resolve: (query, _parent, { period }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.budget.findMany({
        ...query,
        where: {
          userId: user.id,
          ...(period
            ? {
                periodStart: { lte: new Date(period.to) },
                periodEnd: { gte: new Date(period.from) },
              }
            : {}),
        },
        orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      });
    },
  }),
);

// --- Mutations --------------------------------------------------------------

builder.mutationField("setBudget", (t) =>
  t.field({
    type: BudgetPayloadRef,
    args: { input: t.arg({ type: SetBudgetInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      if (BigInt(input.money.amountMinor) < 0n) {
        throw new GraphQLError("amountMinor must be positive", {
          extensions: { code: "INVALID_AMOUNT" },
        });
      }
      const periodStart = new Date(input.periodStart);
      const budget = await ctx.prisma.budget.upsert({
        where: {
          userId_categoryId_periodStart: {
            userId: user.id,
            categoryId: input.categoryId ?? null,
            periodStart,
          },
        },
        create: {
          userId: user.id,
          categoryId: input.categoryId ?? null,
          amountMinor: BigInt(input.money.amountMinor),
          currency: input.money.currency.toUpperCase(),
          periodStart,
          periodEnd: new Date(input.periodEnd),
          rollover: input.rollover ?? false,
        },
        update: {
          amountMinor: BigInt(input.money.amountMinor),
          currency: input.money.currency.toUpperCase(),
          periodEnd: new Date(input.periodEnd),
          rollover: input.rollover ?? false,
        },
      });
      return { budgetId: budget.id };
    },
  }),
);

builder.mutationField("deleteBudget", (t) =>
  t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.budget.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Budget not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await ctx.prisma.budget.delete({ where: { id } });
      return true;
    },
  }),
);
