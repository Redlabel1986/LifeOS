// ============================================================================
// apps/api — Subscription type + mutations
// ----------------------------------------------------------------------------
// Includes the cancellation draft flow: generate → user reviews → send.
// ============================================================================

import {
  draftCancellationEmail,
  lookupSubscriptionPlans,
  type SubscriptionPlan,
} from "@lifeos/ai";
import {
  BillingCycle,
  Locale,
  Prisma,
  SubscriptionStatus,
} from "@lifeos/db";
import { sendMail } from "@lifeos/mail";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import {
  MoneyInput,
  MoneyRef,
  PageInfoRef,
  PageInput,
  normalizePage,
} from "./shared.js";

// --- Subscription object ----------------------------------------------------

builder.prismaObject("Subscription", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    description: t.exposeString("description", { nullable: true }),
    status: t.field({
      type: SubscriptionStatus,
      resolve: (s) => s.status,
    }),
    money: t.field({
      type: MoneyRef,
      resolve: (s) => ({ amountMinor: s.amountMinor, currency: s.currency }),
    }),
    billingCycle: t.field({
      type: BillingCycle,
      resolve: (s) => s.billingCycle,
    }),
    customCycleDays: t.exposeInt("customCycleDays", { nullable: true }),
    startedAt: t.field({
      type: "DateTime",
      resolve: (s) => s.startedAt.toISOString(),
    }),
    nextRenewalAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (s) => s.nextRenewalAt?.toISOString() ?? null,
    }),
    cancellationDeadline: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (s) => s.cancellationDeadline?.toISOString() ?? null,
    }),
    cancelledAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (s) => s.cancelledAt?.toISOString() ?? null,
    }),
    cancellationUrl: t.exposeString("cancellationUrl", { nullable: true }),
    contactEmail: t.exposeString("contactEmail", { nullable: true }),
    autoDetected: t.exposeBoolean("autoDetected"),
    detectionConfidence: t.exposeFloat("detectionConfidence", {
      nullable: true,
    }),
    category: t.relation("category", { nullable: true }),
    merchant: t.relation("merchant", { nullable: true }),
    upcomingReminder: t.prismaField({
      type: "SubscriptionReminder",
      nullable: true,
      resolve: (query, parent, _args, ctx) =>
        ctx.prisma.subscriptionReminder.findFirst({
          ...query,
          where: {
            subscriptionId: parent.id,
            sentAt: null,
            remindAt: { gte: new Date() },
          },
          orderBy: { remindAt: "asc" },
        }),
    }),
    recentTransactions: t.prismaField({
      type: ["Transaction"],
      args: { limit: t.arg.int({ required: false, defaultValue: 5 }) },
      resolve: (query, parent, { limit }, ctx) =>
        ctx.prisma.transaction.findMany({
          ...query,
          where: { subscriptionId: parent.id },
          orderBy: { occurredAt: "desc" },
          take: Math.min(Math.max(limit ?? 5, 1), 50),
        }),
    }),
    createdAt: t.field({
      type: "DateTime",
      resolve: (s) => s.createdAt.toISOString(),
    }),
    updatedAt: t.field({
      type: "DateTime",
      resolve: (s) => s.updatedAt.toISOString(),
    }),
  }),
});

builder.prismaObject("SubscriptionReminder", {
  fields: (t) => ({
    id: t.exposeID("id"),
    remindAt: t.field({
      type: "DateTime",
      resolve: (r) => r.remindAt.toISOString(),
    }),
    sentAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (r) => r.sentAt?.toISOString() ?? null,
    }),
    channel: t.string({ resolve: (r) => r.channel }),
  }),
});

// --- Page -------------------------------------------------------------------

interface SubscriptionPageShape {
  items: Array<{ id: string }>;
  totalCount: number;
  limit: number;
  offset: number;
}

const SubscriptionPageRef = builder
  .objectRef<SubscriptionPageShape>("SubscriptionPage")
  .implement({
    fields: (t) => ({
      items: t.prismaField({
        type: ["Subscription"],
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.subscription.findMany({
            ...query,
            where: { id: { in: parent.items.map((i) => i.id) } },
            orderBy: { nextRenewalAt: "asc" },
          }),
      }),
      pageInfo: t.field({
        type: PageInfoRef,
        resolve: (p) => ({
          totalCount: p.totalCount,
          hasMore: p.offset + p.items.length < p.totalCount,
          limit: p.limit,
          offset: p.offset,
        }),
      }),
    }),
  });

// --- Inputs -----------------------------------------------------------------

const SubscriptionFilter = builder.inputType("SubscriptionFilter", {
  fields: (t) => ({
    statuses: t.field({ type: [SubscriptionStatus], required: false }),
    categoryIds: t.idList({ required: false }),
    renewalBefore: t.field({ type: "DateTime", required: false }),
  }),
});

const CreateSubscriptionInput = builder.inputType("CreateSubscriptionInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    description: t.string({ required: false }),
    money: t.field({ type: MoneyInput, required: true }),
    billingCycle: t.field({ type: BillingCycle, required: true }),
    customCycleDays: t.int({ required: false }),
    startedAt: t.field({ type: "DateTime", required: true }),
    nextRenewalAt: t.field({ type: "DateTime", required: false }),
    cancellationDeadline: t.field({ type: "DateTime", required: false }),
    cancellationUrl: t.string({ required: false }),
    contactEmail: t.string({ required: false }),
    categoryId: t.id({ required: false }),
    merchantId: t.id({ required: false }),
  }),
});

const UpdateSubscriptionInput = builder.inputType("UpdateSubscriptionInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    description: t.string({ required: false }),
    money: t.field({ type: MoneyInput, required: false }),
    billingCycle: t.field({ type: BillingCycle, required: false }),
    customCycleDays: t.int({ required: false }),
    status: t.field({ type: SubscriptionStatus, required: false }),
    nextRenewalAt: t.field({ type: "DateTime", required: false }),
    cancellationDeadline: t.field({ type: "DateTime", required: false }),
    cancellationUrl: t.string({ required: false }),
    contactEmail: t.string({ required: false }),
    categoryId: t.id({ required: false }),
    merchantId: t.id({ required: false }),
  }),
});

interface SubscriptionPayloadShape {
  subscriptionId: string;
}

const SubscriptionPayloadRef = builder
  .objectRef<SubscriptionPayloadShape>("SubscriptionPayload")
  .implement({
    fields: (t) => ({
      subscription: t.prismaField({
        type: "Subscription",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.subscription.findUniqueOrThrow({
            ...query,
            where: { id: parent.subscriptionId },
          }),
      }),
    }),
  });

interface CancellationDraftShape {
  subject: string;
  body: string;
  recipient: string | null;
  locale: Locale;
}

const CancellationDraftRef = builder
  .objectRef<CancellationDraftShape>("CancellationDraft")
  .implement({
    fields: (t) => ({
      subject: t.exposeString("subject"),
      body: t.exposeString("body"),
      recipient: t.exposeString("recipient", { nullable: true }),
      locale: t.field({ type: Locale, resolve: (p) => p.locale }),
    }),
  });

// --- Queries ----------------------------------------------------------------

builder.queryField("subscription", (t) =>
  t.prismaField({
    type: "Subscription",
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _parent, { id }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.subscription.findFirst({
        ...query,
        where: { id, userId: user.id },
      });
    },
  }),
);

builder.queryField("subscriptions", (t) =>
  t.field({
    type: SubscriptionPageRef,
    args: {
      filter: t.arg({ type: SubscriptionFilter, required: false }),
      page: t.arg({ type: PageInput, required: false }),
    },
    resolve: async (_parent, { filter, page }, ctx) => {
      const user = requireUser(ctx);
      const { limit, offset } = normalizePage(page);
      const where: Prisma.SubscriptionWhereInput = { userId: user.id };
      if (filter?.statuses?.length) where.status = { in: filter.statuses };
      if (filter?.categoryIds?.length)
        where.categoryId = { in: filter.categoryIds };
      if (filter?.renewalBefore)
        where.nextRenewalAt = { lte: new Date(filter.renewalBefore) };
      const [items, totalCount] = await Promise.all([
        ctx.prisma.subscription.findMany({
          where,
          orderBy: { nextRenewalAt: "asc" },
          take: limit,
          skip: offset,
          select: { id: true },
        }),
        ctx.prisma.subscription.count({ where }),
      ]);
      return { items, totalCount, limit, offset };
    },
  }),
);

// --- Mutations --------------------------------------------------------------

builder.mutationField("promoteTransactionToSubscription", (t) =>
  t.field({
    type: SubscriptionPayloadRef,
    args: {
      transactionId: t.arg.id({ required: true }),
      billingCycle: t.arg({ type: BillingCycle, required: false }),
    },
    resolve: async (_parent, { transactionId, billingCycle }, ctx) => {
      const user = requireUser(ctx);
      const tx = await ctx.prisma.transaction.findFirst({
        where: { id: transactionId, userId: user.id },
        include: { merchant: true, category: true },
      });
      if (!tx) {
        throw new GraphQLError("Transaction not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const cycle = billingCycle ?? BillingCycle.MONTHLY;
      const advanceByCycle = (from: Date): Date => {
        const d = new Date(from.getTime());
        switch (cycle) {
          case BillingCycle.WEEKLY:
            d.setUTCDate(d.getUTCDate() + 7);
            break;
          case BillingCycle.MONTHLY:
            d.setUTCMonth(d.getUTCMonth() + 1);
            break;
          case BillingCycle.QUARTERLY:
            d.setUTCMonth(d.getUTCMonth() + 3);
            break;
          case BillingCycle.SEMI_ANNUAL:
            d.setUTCMonth(d.getUTCMonth() + 6);
            break;
          case BillingCycle.ANNUAL:
            d.setUTCFullYear(d.getUTCFullYear() + 1);
            break;
          case BillingCycle.CUSTOM:
            d.setUTCMonth(d.getUTCMonth() + 1);
            break;
        }
        return d;
      };

      const name =
        tx.merchant?.displayName ?? tx.description ?? "Untitled subscription";

      // Reuse an existing active subscription for the same merchant if present.
      const existing = tx.merchantId
        ? await ctx.prisma.subscription.findFirst({
            where: {
              userId: user.id,
              merchantId: tx.merchantId,
              status: SubscriptionStatus.ACTIVE,
            },
          })
        : null;

      if (existing) {
        await ctx.prisma.transaction.update({
          where: { id: tx.id },
          data: { subscriptionId: existing.id },
        });
        return { subscriptionId: existing.id };
      }

      const created = await ctx.prisma.subscription.create({
        data: {
          userId: user.id,
          merchantId: tx.merchantId,
          categoryId: tx.categoryId,
          name,
          amountMinor: tx.amountMinor,
          currency: tx.currency,
          billingCycle: cycle,
          startedAt: tx.occurredAt,
          nextRenewalAt: advanceByCycle(tx.occurredAt),
          autoDetected: false,
        },
      });

      await ctx.prisma.transaction.update({
        where: { id: tx.id },
        data: { subscriptionId: created.id },
      });

      return { subscriptionId: created.id };
    },
  }),
);

builder.mutationField("createSubscription", (t) =>
  t.field({
    type: SubscriptionPayloadRef,
    args: { input: t.arg({ type: CreateSubscriptionInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      if (BigInt(input.money.amountMinor) < 0n) {
        throw new GraphQLError("amountMinor must be positive", {
          extensions: { code: "INVALID_AMOUNT" },
        });
      }
      const created = await ctx.prisma.subscription.create({
        data: {
          userId: user.id,
          name: input.name,
          description: input.description ?? null,
          amountMinor: BigInt(input.money.amountMinor),
          currency: input.money.currency.toUpperCase(),
          billingCycle: input.billingCycle,
          customCycleDays: input.customCycleDays ?? null,
          startedAt: new Date(input.startedAt),
          nextRenewalAt: input.nextRenewalAt
            ? new Date(input.nextRenewalAt)
            : null,
          cancellationDeadline: input.cancellationDeadline
            ? new Date(input.cancellationDeadline)
            : null,
          cancellationUrl: input.cancellationUrl ?? null,
          contactEmail: input.contactEmail ?? null,
          categoryId: input.categoryId ?? null,
          merchantId: input.merchantId ?? null,
        },
      });
      return { subscriptionId: created.id };
    },
  }),
);

builder.mutationField("updateSubscription", (t) =>
  t.field({
    type: SubscriptionPayloadRef,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateSubscriptionInput, required: true }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.subscription.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Subscription not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      // Build update payload. We spread all provided fields — the frontend
      // only sends fields it wants to change.
      const data: Prisma.SubscriptionUpdateInput = {};

      if (input.name != null) data.name = input.name;
      if (input.description != null) data.description = input.description;
      if (input.money != null) {
        data.amountMinor = BigInt(input.money.amountMinor);
        data.currency = input.money.currency.toUpperCase();
      }
      if (input.billingCycle != null) data.billingCycle = input.billingCycle;
      if (input.customCycleDays != null) data.customCycleDays = input.customCycleDays;
      if (input.status != null) data.status = input.status;
      if (input.nextRenewalAt !== undefined)
        data.nextRenewalAt = input.nextRenewalAt
          ? new Date(input.nextRenewalAt)
          : null;
      if (input.cancellationDeadline !== undefined)
        data.cancellationDeadline = input.cancellationDeadline
          ? new Date(input.cancellationDeadline)
          : null;
      if (input.cancellationUrl != null) data.cancellationUrl = input.cancellationUrl;
      if (input.contactEmail != null) data.contactEmail = input.contactEmail;
      if (input.categoryId !== undefined)
        data.category = input.categoryId
          ? { connect: { id: input.categoryId } }
          : { disconnect: true };
      if (input.merchantId !== undefined)
        data.merchant = input.merchantId
          ? { connect: { id: input.merchantId } }
          : { disconnect: true };

      ctx.logger.info({ id, data: JSON.stringify(data, (_k, v) => typeof v === "bigint" ? v.toString() : v) }, "updateSubscription data");

      const updated = await ctx.prisma.subscription.update({
        where: { id },
        data,
      });
      return { subscriptionId: updated.id };
    },
  }),
);

builder.mutationField("cancelSubscription", (t) =>
  t.field({
    type: SubscriptionPayloadRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.subscription.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Subscription not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const updated = await ctx.prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });
      return { subscriptionId: updated.id };
    },
  }),
);

builder.mutationField("generateCancellationEmail", (t) =>
  t.field({
    type: CancellationDraftRef,
    args: {
      id: t.arg.id({ required: true }),
      locale: t.arg({ type: Locale, required: false }),
    },
    resolve: async (_parent, { id, locale }, ctx) => {
      const user = requireUser(ctx);
      const sub = await ctx.prisma.subscription.findFirst({
        where: { id, userId: user.id },
      });
      if (!sub) {
        throw new GraphQLError("Subscription not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const targetLocale = locale ?? user.locale;
      const draft = await draftCancellationEmail({
        subscriptionName: sub.name,
        customerName: user.displayName,
        cancellationDeadline: sub.cancellationDeadline,
        locale: targetLocale as "de" | "en" | "fr" | "ar",
      });
      return {
        subject: draft.subject,
        body: draft.body,
        recipient: sub.contactEmail,
        locale: targetLocale,
      };
    },
  }),
);

builder.mutationField("sendCancellationEmail", (t) =>
  t.boolean({
    args: {
      id: t.arg.id({ required: true }),
      subject: t.arg.string({ required: true }),
      body: t.arg.string({ required: true }),
    },
    resolve: async (_parent, { id, subject, body }, ctx) => {
      const user = requireUser(ctx);
      const sub = await ctx.prisma.subscription.findFirst({
        where: { id, userId: user.id },
      });
      if (!sub) {
        throw new GraphQLError("Subscription not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (!sub.contactEmail) {
        throw new GraphQLError("No recipient email on file", {
          extensions: { code: "NO_RECIPIENT" },
        });
      }
      await sendMail({
        to: sub.contactEmail,
        subject,
        text: body,
        replyTo: user.email,
      });
      ctx.logger.info(
        { subscriptionId: id, recipient: sub.contactEmail },
        "cancellation email sent",
      );
      return true;
    },
  }),
);

// --- Subscription plan suggestions (AI-powered) ----------------------------

const SubscriptionPlanRef = builder
  .objectRef<SubscriptionPlan>("SubscriptionPlanSuggestion")
  .implement({
    fields: (t) => ({
      serviceName: t.exposeString("serviceName"),
      planName: t.exposeString("planName"),
      monthlyPriceCents: t.exposeInt("monthlyPriceCents"),
      currency: t.exposeString("currency"),
      billingCycle: t.exposeString("billingCycle"),
      annualPriceCents: t.exposeInt("annualPriceCents", { nullable: true }),
    }),
  });

builder.queryField("subscriptionPlanSuggestions", (t) =>
  t.field({
    type: [SubscriptionPlanRef],
    args: { serviceName: t.arg.string({ required: true }) },
    resolve: async (_parent, { serviceName }, ctx) => {
      requireUser(ctx);
      return lookupSubscriptionPlans(serviceName);
    },
  }),
);
