// ============================================================================
// apps/api — Dashboard & Insights
// ----------------------------------------------------------------------------
// Aggregates multiple queries into a single round-trip for the landing page.
// ============================================================================

import { TransactionType } from "@lifeos/db";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import { DateRangeInput, DateRangeRef, MoneyRef } from "./shared.js";

interface CategoryBreakdownItemShape {
  categoryId: string | null;
  totalMinor: bigint;
  currency: string;
  share: number;
  transactionCount: number;
}

const CategoryBreakdownItemRef = builder
  .objectRef<CategoryBreakdownItemShape>("CategoryBreakdownItem")
  .implement({
    fields: (t) => ({
      category: t.prismaField({
        type: "Category",
        nullable: true,
        resolve: (query, parent, _args, ctx) =>
          parent.categoryId
            ? ctx.prisma.category.findUnique({
                ...query,
                where: { id: parent.categoryId },
              })
            : null,
      }),
      total: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.totalMinor, currency: p.currency }),
      }),
      share: t.exposeFloat("share"),
      transactionCount: t.exposeInt("transactionCount"),
    }),
  });

interface MonthlySeriesPointShape {
  month: Date;
  incomeMinor: bigint;
  expenseMinor: bigint;
  currency: string;
}

const MonthlySeriesPointRef = builder
  .objectRef<MonthlySeriesPointShape>("MonthlySeriesPoint")
  .implement({
    fields: (t) => ({
      month: t.field({
        type: "DateTime",
        resolve: (p) => p.month.toISOString(),
      }),
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
    }),
  });

interface AnomalyShape {
  id: string;
  kind: string;
  message: string;
  severity: string;
  relatedTransactionId?: string | null;
  relatedSubscriptionId?: string | null;
}

const AnomalyRef = builder.objectRef<AnomalyShape>("Anomaly").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    kind: t.exposeString("kind"),
    message: t.exposeString("message"),
    severity: t.exposeString("severity"),
    relatedTransaction: t.prismaField({
      type: "Transaction",
      nullable: true,
      resolve: (query, parent, _args, ctx) =>
        parent.relatedTransactionId
          ? ctx.prisma.transaction.findUnique({
              ...query,
              where: { id: parent.relatedTransactionId },
            })
          : null,
    }),
    relatedSubscription: t.prismaField({
      type: "Subscription",
      nullable: true,
      resolve: (query, parent, _args, ctx) =>
        parent.relatedSubscriptionId
          ? ctx.prisma.subscription.findUnique({
              ...query,
              where: { id: parent.relatedSubscriptionId },
            })
          : null,
    }),
  }),
});

interface DashboardOverviewShape {
  period: { from: Date; to: Date };
  currency: string;
  incomeMinor: bigint;
  expenseMinor: bigint;
  expenseByCategory: CategoryBreakdownItemShape[];
  monthlyTrend: MonthlySeriesPointShape[];
  upcomingRenewalIds: string[];
  budgetIds: string[];
  recentTransactionIds: string[];
  anomalies: AnomalyShape[];
}

const DashboardOverviewRef = builder
  .objectRef<DashboardOverviewShape>("DashboardOverview")
  .implement({
    fields: (t) => ({
      period: t.field({
        type: DateRangeRef,
        resolve: (p) => p.period,
      }),
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
      expenseByCategory: t.field({
        type: [CategoryBreakdownItemRef],
        resolve: (p) => p.expenseByCategory,
      }),
      monthlyTrend: t.field({
        type: [MonthlySeriesPointRef],
        resolve: (p) => p.monthlyTrend,
      }),
      upcomingRenewals: t.prismaField({
        type: ["Subscription"],
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.subscription.findMany({
            ...query,
            where: { id: { in: parent.upcomingRenewalIds } },
            orderBy: { nextRenewalAt: "asc" },
          }),
      }),
      budgets: t.prismaField({
        type: ["Budget"],
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.budget.findMany({
            ...query,
            where: { id: { in: parent.budgetIds } },
          }),
      }),
      recentTransactions: t.prismaField({
        type: ["Transaction"],
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.transaction.findMany({
            ...query,
            where: { id: { in: parent.recentTransactionIds } },
            orderBy: { occurredAt: "desc" },
          }),
      }),
      anomalies: t.field({
        type: [AnomalyRef],
        resolve: (p) => p.anomalies,
      }),
    }),
  });

// --- Aggregation helpers ----------------------------------------------------

const monthsBetween = (
  from: Date,
  to: Date,
): Date[] => {
  const months: Date[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
  );
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    months.push(new Date(cursor.getTime()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
};

// --- Query ------------------------------------------------------------------

builder.queryField("dashboardOverview", (t) =>
  t.field({
    type: DashboardOverviewRef,
    args: { period: t.arg({ type: DateRangeInput, required: true }) },
    resolve: async (_parent, { period }, ctx) => {
      const user = requireUser(ctx);
      const currency = user.currency;
      const from = new Date(period.from);
      const to = new Date(period.to);

      const [txs, subs, budgets, recent] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where: {
            userId: user.id,
            occurredAt: { gte: from, lte: to },
            currency,
          },
          select: {
            id: true,
            type: true,
            amountMinor: true,
            categoryId: true,
            occurredAt: true,
          },
        }),
        ctx.prisma.subscription.findMany({
          where: {
            userId: user.id,
            status: "ACTIVE",
            nextRenewalAt: { not: null, lte: new Date(to.getTime() + 30 * 86_400_000) },
          },
          select: { id: true },
          orderBy: { nextRenewalAt: "asc" },
          take: 10,
        }),
        ctx.prisma.budget.findMany({
          where: {
            userId: user.id,
            periodStart: { lte: to },
            periodEnd: { gte: from },
          },
          select: { id: true },
        }),
        ctx.prisma.transaction.findMany({
          where: { userId: user.id },
          orderBy: { occurredAt: "desc" },
          take: 10,
          select: { id: true },
        }),
      ]);

      let incomeMinor = 0n;
      let expenseMinor = 0n;
      const byCategory = new Map<
        string | null,
        { totalMinor: bigint; count: number }
      >();
      const monthBuckets = new Map<
        number,
        { incomeMinor: bigint; expenseMinor: bigint }
      >();

      for (const tx of txs) {
        if (tx.type === TransactionType.INCOME) {
          incomeMinor += tx.amountMinor;
        } else if (tx.type === TransactionType.EXPENSE) {
          expenseMinor += tx.amountMinor;
          const key = tx.categoryId;
          const entry = byCategory.get(key) ?? {
            totalMinor: 0n,
            count: 0,
          };
          entry.totalMinor += tx.amountMinor;
          entry.count += 1;
          byCategory.set(key, entry);
        }
        const monthKey = Date.UTC(
          tx.occurredAt.getUTCFullYear(),
          tx.occurredAt.getUTCMonth(),
          1,
        );
        const bucket = monthBuckets.get(monthKey) ?? {
          incomeMinor: 0n,
          expenseMinor: 0n,
        };
        if (tx.type === TransactionType.INCOME)
          bucket.incomeMinor += tx.amountMinor;
        if (tx.type === TransactionType.EXPENSE)
          bucket.expenseMinor += tx.amountMinor;
        monthBuckets.set(monthKey, bucket);
      }

      const totalExpense = Number(expenseMinor);
      const expenseByCategory: CategoryBreakdownItemShape[] = Array.from(
        byCategory.entries(),
      )
        .map(([categoryId, v]) => ({
          categoryId,
          totalMinor: v.totalMinor,
          currency,
          share: totalExpense === 0 ? 0 : Number(v.totalMinor) / totalExpense,
          transactionCount: v.count,
        }))
        .sort((a, b) => Number(b.totalMinor - a.totalMinor));

      const monthlyTrend: MonthlySeriesPointShape[] = monthsBetween(from, to).map(
        (month) => {
          const bucket = monthBuckets.get(month.getTime()) ?? {
            incomeMinor: 0n,
            expenseMinor: 0n,
          };
          return {
            month,
            incomeMinor: bucket.incomeMinor,
            expenseMinor: bucket.expenseMinor,
            currency,
          };
        },
      );

      // Simple anomaly heuristics — budget overruns only (MVP).
      const anomalies: AnomalyShape[] = [];
      for (const b of await ctx.prisma.budget.findMany({
        where: {
          userId: user.id,
          periodStart: { lte: to },
          periodEnd: { gte: from },
        },
      })) {
        const spent = txs
          .filter(
            (tx) =>
              tx.type === TransactionType.EXPENSE &&
              tx.categoryId === b.categoryId &&
              tx.occurredAt >= b.periodStart &&
              tx.occurredAt < b.periodEnd,
          )
          .reduce((acc, tx) => acc + tx.amountMinor, 0n);
        if (b.amountMinor > 0n && spent > b.amountMinor) {
          anomalies.push({
            id: `budget-${b.id}`,
            kind: "BUDGET_EXCEEDED",
            severity: "warning",
            message: "Budget exceeded for this period",
          });
        }
      }

      return {
        period: { from, to },
        currency,
        incomeMinor,
        expenseMinor,
        expenseByCategory,
        monthlyTrend,
        upcomingRenewalIds: subs.map((s) => s.id),
        budgetIds: budgets.map((b) => b.id),
        recentTransactionIds: recent.map((r) => r.id),
        anomalies,
      };
    },
  }),
);
