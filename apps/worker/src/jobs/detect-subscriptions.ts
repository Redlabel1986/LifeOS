// ============================================================================
// worker/jobs/detect-subscriptions
// ----------------------------------------------------------------------------
// Scans a user's transaction history for recurring payments. Heuristic:
//   * Group by merchant + rounded amount
//   * If ≥ 3 occurrences, evenly spaced (±3 days), suggest a subscription
//   * Skip if an active subscription for that merchant already exists
// ============================================================================

import {
  BillingCycle,
  prisma,
  TransactionType,
  type Transaction,
} from "@lifeos/db";
import { Worker, type Job } from "bullmq";
import { connection, type DetectSubscriptionsJob } from "../queue.js";
import { logger } from "../logger.js";

interface RecurrenceCandidate {
  merchantId: string;
  amountMinor: bigint;
  currency: string;
  occurrences: Transaction[];
  cycle: BillingCycle;
}

const cycleFromInterval = (days: number): BillingCycle | null => {
  if (Math.abs(days - 7) <= 2) return BillingCycle.WEEKLY;
  if (Math.abs(days - 30) <= 3) return BillingCycle.MONTHLY;
  if (Math.abs(days - 90) <= 5) return BillingCycle.QUARTERLY;
  if (Math.abs(days - 182) <= 7) return BillingCycle.SEMI_ANNUAL;
  if (Math.abs(days - 365) <= 10) return BillingCycle.ANNUAL;
  return null;
};

const detectForUser = async (userId: string): Promise<void> => {
  const since = new Date(Date.now() - 365 * 86_400_000);
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: since },
      merchantId: { not: null },
    },
    orderBy: { occurredAt: "asc" },
  });

  const groups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!tx.merchantId) continue;
    const key = `${tx.merchantId}::${tx.amountMinor}::${tx.currency}`;
    const g = groups.get(key) ?? [];
    g.push(tx);
    groups.set(key, g);
  }

  const candidates: RecurrenceCandidate[] = [];
  for (const [, group] of groups) {
    if (group.length < 3) continue;
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i += 1) {
      const prev = group[i - 1]!;
      const curr = group[i]!;
      const days =
        (curr.occurredAt.getTime() - prev.occurredAt.getTime()) / 86_400_000;
      intervals.push(days);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const cycle = cycleFromInterval(avg);
    if (!cycle) continue;
    const first = group[0]!;
    candidates.push({
      merchantId: first.merchantId!,
      amountMinor: first.amountMinor,
      currency: first.currency,
      occurrences: group,
      cycle,
    });
  }

  for (const c of candidates) {
    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        merchantId: c.merchantId,
        status: "ACTIVE",
      },
    });
    if (existing) continue;
    const merchant = await prisma.merchant.findUnique({
      where: { id: c.merchantId },
    });
    if (!merchant) continue;
    const last = c.occurrences[c.occurrences.length - 1]!;
    const nextRenewal = new Date(last.occurredAt.getTime() + 30 * 86_400_000);
    await prisma.subscription.create({
      data: {
        userId,
        merchantId: c.merchantId,
        name: merchant.displayName,
        amountMinor: c.amountMinor,
        currency: c.currency,
        billingCycle: c.cycle,
        startedAt: c.occurrences[0]!.occurredAt,
        nextRenewalAt: nextRenewal,
        autoDetected: true,
        detectionConfidence: Math.min(0.5 + c.occurrences.length * 0.1, 0.95),
      },
    });
    logger.info(
      { userId, merchant: merchant.displayName },
      "auto-detected subscription",
    );
  }
};

export const startDetectSubscriptionsWorker =
  (): Worker<DetectSubscriptionsJob> => {
    return new Worker<DetectSubscriptionsJob>(
      "detect-subscriptions",
      async (job: Job<DetectSubscriptionsJob>) => {
        logger.info({ userId: job.data.userId }, "detecting subscriptions");
        await detectForUser(job.data.userId);
      },
      { connection, concurrency: 4 },
    );
  };
