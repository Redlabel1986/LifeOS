// ============================================================================
// apps/api — Transaction type, queries, mutations
// ----------------------------------------------------------------------------
// The workhorse of the API. Filters, pagination, money, mutations.
// Every query is scoped to the authenticated user.
// ============================================================================

import {
  Prisma,
  TransactionSource,
  TransactionType,
} from "@lifeos/db";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import {
  DateRangeInput,
  MoneyInput,
  MoneyRef,
  PageInfoRef,
  PageInput,
  normalizePage,
} from "./shared.js";

interface TransactionTotalsShape {
  incomeMinor: bigint;
  expenseMinor: bigint;
  currency: string;
  count: number;
}

const TransactionTotalsRef = builder
  .objectRef<TransactionTotalsShape>("TransactionTotals")
  .implement({
    fields: (t) => ({
      income: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.incomeMinor, currency: p.currency }),
      }),
      expense: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.expenseMinor, currency: p.currency }),
      }),
      net: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: p.incomeMinor - p.expenseMinor,
          currency: p.currency,
        }),
      }),
      transactionCount: t.int({
        resolve: (p) => p.count,
      }),
    }),
  });

// --- Transaction object -----------------------------------------------------

builder.prismaObject("Transaction", {
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.field({ type: TransactionType, resolve: (tx) => tx.type }),
    source: t.field({ type: TransactionSource, resolve: (tx) => tx.source }),
    money: t.field({
      type: MoneyRef,
      resolve: (tx) => ({
        amountMinor: tx.amountMinor,
        currency: tx.currency,
      }),
    }),
    exchangeRate: t.field({
      type: "Decimal",
      nullable: true,
      resolve: (tx) => (tx.exchangeRate ? String(tx.exchangeRate) : null),
    }),
    occurredAt: t.field({
      type: "DateTime",
      resolve: (tx) => tx.occurredAt.toISOString(),
    }),
    bookedAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (tx) => tx.bookedAt?.toISOString() ?? null,
    }),
    description: t.exposeString("description", { nullable: true }),
    note: t.exposeString("note", { nullable: true }),
    tags: t.exposeStringList("tags"),
    taxDeductible: t.exposeBoolean("taxDeductible"),
    aiConfidence: t.exposeFloat("aiConfidence", { nullable: true }),
    needsReview: t.exposeBoolean("needsReview"),
    category: t.relation("category", { nullable: true }),
    merchant: t.relation("merchant", { nullable: true }),
    subscription: t.relation("subscription", { nullable: true }),
    document: t.relation("document", { nullable: true }),
    createdAt: t.field({
      type: "DateTime",
      resolve: (tx) => tx.createdAt.toISOString(),
    }),
    updatedAt: t.field({
      type: "DateTime",
      resolve: (tx) => tx.updatedAt.toISOString(),
    }),
  }),
});

// --- Page type --------------------------------------------------------------

interface TransactionPageShape {
  items: Array<{ id: string }>;
  totalCount: number;
  limit: number;
  offset: number;
}

const TransactionPageRef = builder
  .objectRef<TransactionPageShape>("TransactionPage")
  .implement({
    fields: (t) => ({
      items: t.prismaField({
        type: ["Transaction"],
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.transaction.findMany({
            ...query,
            where: { id: { in: parent.items.map((i) => i.id) } },
            orderBy: { occurredAt: "desc" },
          }),
      }),
      pageInfo: t.field({
        type: PageInfoRef,
        resolve: (parent) => ({
          totalCount: parent.totalCount,
          hasMore: parent.offset + parent.items.length < parent.totalCount,
          limit: parent.limit,
          offset: parent.offset,
        }),
      }),
    }),
  });

// --- Filter + Sort inputs ---------------------------------------------------

const TransactionFilter = builder.inputType("TransactionFilter", {
  fields: (t) => ({
    types: t.field({ type: [TransactionType], required: false }),
    categoryIds: t.idList({ required: false }),
    merchantIds: t.idList({ required: false }),
    subscriptionId: t.id({ required: false }),
    dateRange: t.field({ type: DateRangeInput, required: false }),
    minAmountMinor: t.field({ type: "BigInt", required: false }),
    maxAmountMinor: t.field({ type: "BigInt", required: false }),
    tags: t.stringList({ required: false }),
    needsReview: t.boolean({ required: false }),
    search: t.string({ required: false }),
  }),
});

const TransactionSort = builder.inputType("TransactionSort", {
  fields: (t) => ({
    field: t.string({ required: false, defaultValue: "OCCURRED_AT" }),
    direction: t.string({ required: false, defaultValue: "DESC" }),
  }),
});

// --- Input helpers ----------------------------------------------------------

const buildWhere = (
  userId: string,
  filter: typeof TransactionFilter.$inferInput | null | undefined,
): Prisma.TransactionWhereInput => {
  const where: Prisma.TransactionWhereInput = { userId };
  if (!filter) return where;
  if (filter.types?.length) where.type = { in: filter.types };
  if (filter.categoryIds?.length)
    where.categoryId = { in: filter.categoryIds };
  if (filter.merchantIds?.length)
    where.merchantId = { in: filter.merchantIds };
  if (filter.subscriptionId) where.subscriptionId = filter.subscriptionId;
  if (filter.dateRange) {
    where.occurredAt = {
      gte: new Date(filter.dateRange.from),
      lte: new Date(filter.dateRange.to),
    };
  }
  if (filter.minAmountMinor !== undefined && filter.minAmountMinor !== null) {
    where.amountMinor = {
      ...(where.amountMinor as object | undefined),
      gte: BigInt(filter.minAmountMinor),
    };
  }
  if (filter.maxAmountMinor !== undefined && filter.maxAmountMinor !== null) {
    where.amountMinor = {
      ...(where.amountMinor as object | undefined),
      lte: BigInt(filter.maxAmountMinor),
    };
  }
  if (filter.tags?.length) where.tags = { hasSome: filter.tags };
  if (filter.needsReview !== undefined && filter.needsReview !== null)
    where.needsReview = filter.needsReview;
  if (filter.search) {
    where.OR = [
      { description: { contains: filter.search, mode: "insensitive" } },
      { note: { contains: filter.search, mode: "insensitive" } },
    ];
  }
  return where;
};

const buildOrderBy = (
  sort: typeof TransactionSort.$inferInput | null | undefined,
): Prisma.TransactionOrderByWithRelationInput => {
  const field = sort?.field ?? "OCCURRED_AT";
  const direction = sort?.direction === "ASC" ? "asc" : "desc";
  switch (field) {
    case "AMOUNT":
      return { amountMinor: direction };
    case "CREATED_AT":
      return { createdAt: direction };
    default:
      return { occurredAt: direction };
  }
};

// --- CUD inputs -------------------------------------------------------------

const CreateTransactionInput = builder.inputType("CreateTransactionInput", {
  fields: (t) => ({
    type: t.field({ type: TransactionType, required: true }),
    money: t.field({ type: MoneyInput, required: true }),
    occurredAt: t.field({ type: "DateTime", required: true }),
    categoryId: t.id({ required: false }),
    merchantId: t.id({ required: false }),
    description: t.string({ required: false }),
    note: t.string({ required: false }),
    tags: t.stringList({ required: false }),
    taxDeductible: t.boolean({ required: false }),
    documentId: t.id({ required: false }),
    subscriptionId: t.id({ required: false }),
  }),
});

const UpdateTransactionInput = builder.inputType("UpdateTransactionInput", {
  fields: (t) => ({
    type: t.field({ type: TransactionType, required: false }),
    money: t.field({ type: MoneyInput, required: false }),
    occurredAt: t.field({ type: "DateTime", required: false }),
    categoryId: t.id({ required: false }),
    merchantId: t.id({ required: false }),
    description: t.string({ required: false }),
    note: t.string({ required: false }),
    tags: t.stringList({ required: false }),
    taxDeductible: t.boolean({ required: false }),
  }),
});

interface TransactionPayloadShape {
  transactionId: string;
}

const TransactionPayloadRef = builder
  .objectRef<TransactionPayloadShape>("TransactionPayload")
  .implement({
    fields: (t) => ({
      transaction: t.prismaField({
        type: "Transaction",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.transaction.findUniqueOrThrow({
            ...query,
            where: { id: parent.transactionId },
          }),
      }),
    }),
  });

// --- Queries ----------------------------------------------------------------

builder.queryField("transaction", (t) =>
  t.prismaField({
    type: "Transaction",
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _parent, { id }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.transaction.findFirst({
        ...query,
        where: { id, userId: user.id },
      });
    },
  }),
);

builder.queryField("transactions", (t) =>
  t.field({
    type: TransactionPageRef,
    args: {
      filter: t.arg({ type: TransactionFilter, required: false }),
      sort: t.arg({ type: TransactionSort, required: false }),
      page: t.arg({ type: PageInput, required: false }),
    },
    resolve: async (_parent, { filter, sort, page }, ctx) => {
      const user = requireUser(ctx);
      const { limit, offset } = normalizePage(page);
      const where = buildWhere(user.id, filter);
      const orderBy = buildOrderBy(sort);
      const [items, totalCount] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where,
          orderBy,
          take: limit,
          skip: offset,
          select: { id: true },
        }),
        ctx.prisma.transaction.count({ where }),
      ]);
      return { items, totalCount, limit, offset };
    },
  }),
);

builder.queryField("transactionTotals", (t) =>
  t.field({
    type: TransactionTotalsRef,
    args: {
      filter: t.arg({ type: TransactionFilter, required: false }),
    },
    resolve: async (_parent, { filter }, ctx) => {
      const user = requireUser(ctx);
      const where = buildWhere(user.id, filter);
      const grouped = await ctx.prisma.transaction.groupBy({
        by: ["type", "currency"],
        where,
        _sum: { amountMinor: true },
        _count: { _all: true },
      });
      let incomeMinor = 0n;
      let expenseMinor = 0n;
      let count = 0;
      const currencies = new Set<string>();
      for (const row of grouped) {
        currencies.add(row.currency);
        const sum = row._sum.amountMinor ?? 0n;
        count += row._count._all;
        if (row.type === TransactionType.INCOME) incomeMinor += sum;
        if (row.type === TransactionType.EXPENSE) expenseMinor += sum;
      }
      const currency =
        currencies.size === 1
          ? (currencies.values().next().value as string)
          : user.currency;
      return { incomeMinor, expenseMinor, currency, count };
    },
  }),
);

// --- Mutations --------------------------------------------------------------

const assertPositiveAmount = (v: string | bigint): bigint => {
  const n = typeof v === "bigint" ? v : BigInt(v);
  if (n < 0n) {
    throw new GraphQLError("amountMinor must be positive", {
      extensions: { code: "INVALID_AMOUNT" },
    });
  }
  return n;
};

builder.mutationField("createTransaction", (t) =>
  t.field({
    type: TransactionPayloadRef,
    args: { input: t.arg({ type: CreateTransactionInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      const amount = assertPositiveAmount(input.money.amountMinor);
      const created = await ctx.prisma.transaction.create({
        data: {
          userId: user.id,
          type: input.type,
          source: TransactionSource.MANUAL,
          amountMinor: amount,
          currency: input.money.currency.toUpperCase(),
          occurredAt: new Date(input.occurredAt),
          categoryId: input.categoryId ?? null,
          merchantId: input.merchantId ?? null,
          subscriptionId: input.subscriptionId ?? null,
          documentId: input.documentId ?? null,
          description: input.description ?? null,
          note: input.note ?? null,
          tags: input.tags ?? [],
          taxDeductible: input.taxDeductible ?? false,
        },
      });
      return { transactionId: created.id };
    },
  }),
);

builder.mutationField("updateTransaction", (t) =>
  t.field({
    type: TransactionPayloadRef,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateTransactionInput, required: true }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.transaction.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Transaction not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const data: Prisma.TransactionUpdateInput = {};
      if (input.type) data.type = input.type;
      if (input.money) {
        data.amountMinor = assertPositiveAmount(input.money.amountMinor);
        data.currency = input.money.currency.toUpperCase();
      }
      if (input.occurredAt) data.occurredAt = new Date(input.occurredAt);
      if (input.categoryId !== undefined)
        data.category = input.categoryId
          ? { connect: { id: input.categoryId } }
          : { disconnect: true };
      if (input.merchantId !== undefined)
        data.merchant = input.merchantId
          ? { connect: { id: input.merchantId } }
          : { disconnect: true };
      if (input.description !== undefined) data.description = input.description;
      if (input.note !== undefined) data.note = input.note;
      if (input.tags !== undefined) data.tags = input.tags;
      if (input.taxDeductible !== undefined)
        data.taxDeductible = input.taxDeductible;

      const updated = await ctx.prisma.transaction.update({
        where: { id },
        data,
      });
      return { transactionId: updated.id };
    },
  }),
);

builder.mutationField("deleteTransaction", (t) =>
  t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.transaction.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Transaction not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await ctx.prisma.transaction.delete({ where: { id } });
      return true;
    },
  }),
);

builder.mutationField("categorizeTransaction", (t) =>
  t.field({
    type: TransactionPayloadRef,
    args: {
      id: t.arg.id({ required: true }),
      categoryId: t.arg.id({ required: true }),
    },
    resolve: async (_parent, { id, categoryId }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.transaction.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Transaction not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const updated = await ctx.prisma.transaction.update({
        where: { id },
        data: {
          categoryId,
          needsReview: false,
          // Mark this as user-set. Force-re-analyze skips rows with
          // aiConfidence === null + a category.
          aiConfidence: null,
        },
      });
      return { transactionId: updated.id };
    },
  }),
);

// --- CSV Export --------------------------------------------------------------

builder.queryField("transactionsCsv", (t) =>
  t.string({
    args: {
      period: t.arg({ type: DateRangeInput, required: false }),
    },
    resolve: async (_parent, { period }, ctx) => {
      const user = requireUser(ctx);
      const where: Prisma.TransactionWhereInput = { userId: user.id };
      if (period) {
        where.occurredAt = {
          gte: new Date(period.from),
          lte: new Date(period.to),
        };
      }

      const txs = await ctx.prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        include: { category: true, merchant: true },
      });

      const escape = (v: string): string => {
        if (v.includes(",") || v.includes('"') || v.includes("\n"))
          return `"${v.replace(/"/g, '""')}"`;
        return v;
      };

      const header = "Date,Type,Amount,Currency,Description,Category,Merchant,Tax Deductible";
      const rows = txs.map((tx) => {
        const amount = (Number(tx.amountMinor) / 100).toFixed(2);
        return [
          tx.occurredAt.toISOString().slice(0, 10),
          tx.type,
          tx.type === "EXPENSE" ? `-${amount}` : amount,
          tx.currency,
          escape(tx.description ?? ""),
          escape(tx.category?.slug ?? ""),
          escape(tx.merchant?.displayName ?? ""),
          tx.taxDeductible ? "yes" : "no",
        ].join(",");
      });

      return [header, ...rows].join("\n");
    },
  }),
);
