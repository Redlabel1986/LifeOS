// ============================================================================
// apps/api — AI Assistant
// ----------------------------------------------------------------------------
// Free-form chat over the user's finance data. The context blob is built on
// the server so the LLM never gets carte blanche access to the DB.
// ============================================================================

import { answerFinanceQuestion, type Locale as AiLocale } from "@lifeos/ai";
import { TransactionType } from "@lifeos/db";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import { PageInput, normalizePage } from "./shared.js";

builder.prismaObject("AiConversation", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title", { nullable: true }),
    createdAt: t.field({
      type: "DateTime",
      resolve: (c) => c.createdAt.toISOString(),
    }),
    updatedAt: t.field({
      type: "DateTime",
      resolve: (c) => c.updatedAt.toISOString(),
    }),
    messages: t.relation("messages", {
      query: () => ({ orderBy: { createdAt: "asc" } }),
    }),
  }),
});

builder.prismaObject("AiMessage", {
  fields: (t) => ({
    id: t.exposeID("id"),
    role: t.exposeString("role"),
    content: t.exposeString("content"),
    createdAt: t.field({
      type: "DateTime",
      resolve: (m) => m.createdAt.toISOString(),
    }),
  }),
});

const SendAiMessageInput = builder.inputType("SendAiMessageInput", {
  fields: (t) => ({
    conversationId: t.id({ required: false }),
    content: t.string({ required: true }),
  }),
});

interface AiMessagePayloadShape {
  conversationId: string;
  messageId: string;
}

const AiMessagePayloadRef = builder
  .objectRef<AiMessagePayloadShape>("AiMessagePayload")
  .implement({
    fields: (t) => ({
      conversation: t.prismaField({
        type: "AiConversation",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.aiConversation.findUniqueOrThrow({
            ...query,
            where: { id: parent.conversationId },
          }),
      }),
      message: t.prismaField({
        type: "AiMessage",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.aiMessage.findUniqueOrThrow({
            ...query,
            where: { id: parent.messageId },
          }),
      }),
    }),
  });

// --- Queries ----------------------------------------------------------------

builder.queryField("aiConversation", (t) =>
  t.prismaField({
    type: "AiConversation",
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _parent, { id }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.aiConversation.findFirst({
        ...query,
        where: { id, userId: user.id },
      });
    },
  }),
);

builder.queryField("aiConversations", (t) =>
  t.prismaField({
    type: ["AiConversation"],
    args: { page: t.arg({ type: PageInput, required: false }) },
    resolve: (query, _parent, { page }, ctx) => {
      const user = requireUser(ctx);
      const { limit, offset } = normalizePage(page);
      return ctx.prisma.aiConversation.findMany({
        ...query,
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      });
    },
  }),
);

// --- Mutations --------------------------------------------------------------

/**
 * Builds a compact data context for the LLM — last 90 days of transactions,
 * active subscriptions, current budgets. Never sends PII beyond what the user
 * already sees.
 */
const buildFinanceContext = async (
  prisma: import("@lifeos/db").PrismaClient,
  userId: string,
  currency: string,
): Promise<string> => {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [txs, subs, budgets] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: since } },
      include: { category: true, merchant: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    prisma.subscription.findMany({
      where: { userId, status: "ACTIVE" },
      take: 50,
    }),
    prisma.budget.findMany({
      where: { userId, periodEnd: { gte: new Date() } },
      include: { category: true },
      take: 50,
    }),
  ]);

  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const tx of txs) {
    if (tx.type === TransactionType.INCOME) incomeMinor += tx.amountMinor;
    if (tx.type === TransactionType.EXPENSE) expenseMinor += tx.amountMinor;
  }
  const fmt = (m: bigint) => `${(Number(m) / 100).toFixed(2)} ${currency}`;

  const lines: string[] = [];
  lines.push(`Last 90 days totals:`);
  lines.push(`  income:  ${fmt(incomeMinor)}`);
  lines.push(`  expense: ${fmt(expenseMinor)}`);
  lines.push(`  net:     ${fmt(incomeMinor - expenseMinor)}`);
  lines.push("");
  lines.push(`Active subscriptions (${subs.length}):`);
  for (const s of subs.slice(0, 20)) {
    lines.push(`  - ${s.name}: ${fmt(s.amountMinor)} / ${s.billingCycle}`);
  }
  lines.push("");
  lines.push(`Active budgets (${budgets.length}):`);
  for (const b of budgets.slice(0, 20)) {
    const label = b.category ? `category ${b.category.slug}` : "overall";
    lines.push(`  - ${label}: ${fmt(b.amountMinor)}`);
  }
  lines.push("");
  lines.push(`Recent transactions (latest 30):`);
  for (const tx of txs.slice(0, 30)) {
    const when = tx.occurredAt.toISOString().slice(0, 10);
    const sign = tx.type === TransactionType.EXPENSE ? "-" : "+";
    const who = tx.merchant?.displayName ?? tx.description ?? "(unknown)";
    const cat = tx.category?.slug ?? "uncategorized";
    lines.push(
      `  ${when} ${sign}${fmt(tx.amountMinor)} ${who} [${cat}]`,
    );
  }

  return lines.join("\n");
};

builder.mutationField("sendAiMessage", (t) =>
  t.field({
    type: AiMessagePayloadRef,
    args: { input: t.arg({ type: SendAiMessageInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);

      const conversation = input.conversationId
        ? await ctx.prisma.aiConversation.findFirst({
            where: { id: input.conversationId, userId: user.id },
          })
        : await ctx.prisma.aiConversation.create({
            data: { userId: user.id, title: input.content.slice(0, 60) },
          });

      if (!conversation) {
        throw new GraphQLError("Conversation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      await ctx.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: input.content,
        },
      });

      const history = await ctx.prisma.aiMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const context = await buildFinanceContext(
        ctx.prisma,
        user.id,
        user.currency,
      );

      const result = await answerFinanceQuestion({
        question: input.content,
        locale: user.locale as AiLocale,
        context,
        history: history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
      });

      const assistantMessage = await ctx.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: result.answer,
          tokensIn: result.tokensIn ?? null,
          tokensOut: result.tokensOut ?? null,
        },
      });

      await ctx.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return {
        conversationId: conversation.id,
        messageId: assistantMessage.id,
      };
    },
  }),
);

builder.mutationField("deleteAiConversation", (t) =>
  t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.aiConversation.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Conversation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await ctx.prisma.aiConversation.delete({ where: { id } });
      return true;
    },
  }),
);
