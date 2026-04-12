// ============================================================================
// worker/jobs/recategorize-bank
// ----------------------------------------------------------------------------
// Re-runs merchant matching + AI categorization on bank-imported transactions.
// Processes transactions in parallel batches to avoid blocking for minutes.
// ============================================================================

import { categorizeTransaction } from "@lifeos/ai";
import { BillingCycle, Prisma, prisma, type Merchant } from "@lifeos/db";
import { Worker, type Job } from "bullmq";
import { connection, type RecategorizeBankJob } from "../queue.js";
import { logger } from "../logger.js";

const SUBSCRIPTION_SLUG = "subscriptions";

const getMerchants = async (): Promise<Merchant[]> =>
  prisma.merchant.findMany();

const matchMerchant = (
  text: string,
  merchants: Merchant[],
): Merchant | null => {
  const haystack = text.toLowerCase();
  for (const m of merchants) {
    for (const pattern of m.patterns) {
      try {
        if (new RegExp(pattern, "i").test(text)) return m;
      } catch {
        if (haystack.includes(pattern.toLowerCase())) return m;
      }
    }
  }
  return null;
};

/** Process a batch of transactions concurrently. */
const BATCH_SIZE = 5;

const recategorize = async (job: Job<RecategorizeBankJob>): Promise<void> => {
  const { userId, accountId, force } = job.data;

  const bankTxWhere: Prisma.BankTransactionWhereInput = accountId
    ? { accountId }
    : { account: { connection: { userId } } };

  const txFilter: Prisma.TransactionWhereInput = force
    ? {
        userId,
        OR: [
          { categoryId: null },
          { aiConfidence: { not: null } },
          { needsReview: true },
        ],
      }
    : {
        userId,
        OR: [{ categoryId: null }, { needsReview: true }],
      };

  const rows = await prisma.bankTransaction.findMany({
    where: { ...bankTxWhere, lifeosTransaction: txFilter },
    include: { lifeosTransaction: true },
  });

  if (rows.length === 0) {
    logger.info("recategorize: no transactions to process");
    return;
  }

  const merchants = await getMerchants();
  const cats = await prisma.category.findMany({
    where: { OR: [{ userId }, { isSystem: true }] },
    select: { id: true, slug: true, kind: true },
  });

  let updated = 0;

  // Process in parallel batches instead of one-by-one
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        if (!row.lifeosTransaction) return;

        const haystack = [row.counterpartyName, row.remittanceInfo]
          .filter(Boolean)
          .join(" ");
        if (!haystack) return;

        const merchant = matchMerchant(haystack, merchants);
        let categoryId: string | null = row.lifeosTransaction.categoryId;
        let aiConfidence: number | null = row.lifeosTransaction.aiConfidence;

        // 1. Rule-based: merchant defaultCategorySlug (free, instant)
        if (merchant?.defaultCategorySlug) {
          const ruleMatch = cats.find(
            (c) => c.slug === merchant.defaultCategorySlug,
          );
          if (ruleMatch) {
            categoryId = ruleMatch.id;
            aiConfidence = 1.0; // rule-based = high confidence
          }
        }

        // 2. AI fallback: only if no rule matched (saves API costs)
        if (!categoryId) {
          try {
            const kind = row.amountMinor < 0n ? "EXPENSE" : "INCOME";
            const candidates = cats
              .filter((c) => c.kind === kind)
              .map((c) => c.slug);
            if (candidates.length > 0) {
              const result = await categorizeTransaction({
                description: row.remittanceInfo ?? "",
                merchantName:
                  row.counterpartyName ?? merchant?.displayName ?? null,
                amountMajor: Number(row.amountMinor) / 100,
                currency: row.currency,
                availableSlugs: candidates,
              });
              const matched = cats.find((c) => c.slug === result.categorySlug);
              if (matched) {
                categoryId = matched.id;
                aiConfidence = result.confidence;
              }
            }
          } catch (err) {
            logger.warn({ err }, "AI recategorize failed — continuing");
          }
        }

        if (categoryId) {
          const matchedSlug = cats.find((c) => c.id === categoryId)?.slug;
          const effectiveMerchantId = merchant?.id ?? row.lifeosTransaction.merchantId;

          await prisma.transaction.update({
            where: { id: row.lifeosTransaction.id },
            data: {
              categoryId,
              merchantId: effectiveMerchantId,
              aiConfidence,
              needsReview: false,
            },
          });
          updated += 1;

          // Auto-create subscription when categorized as "subscriptions"
          if (matchedSlug === SUBSCRIPTION_SLUG && effectiveMerchantId) {
            try {
              const existingSub = await prisma.subscription.findFirst({
                where: {
                  userId,
                  merchantId: effectiveMerchantId,
                  status: "ACTIVE",
                },
              });
              if (!existingSub) {
                const merchantRecord = merchant ?? await prisma.merchant.findUnique({
                  where: { id: effectiveMerchantId },
                });
                if (merchantRecord) {
                  const txDate = row.lifeosTransaction.occurredAt;
                  const nextRenewal = new Date(txDate.getTime() + 30 * 86_400_000);
                  await prisma.subscription.create({
                    data: {
                      userId,
                      merchantId: effectiveMerchantId,
                      categoryId,
                      name: merchantRecord.displayName,
                      amountMinor: row.lifeosTransaction.amountMinor,
                      currency: row.currency,
                      billingCycle: BillingCycle.MONTHLY,
                      startedAt: txDate,
                      nextRenewalAt: nextRenewal,
                      autoDetected: true,
                      detectionConfidence: aiConfidence ?? 0.7,
                    },
                  });
                  logger.info(
                    { merchant: merchantRecord.displayName },
                    "auto-created subscription from categorization",
                  );
                }
              }
            } catch (err) {
              logger.warn({ err }, "auto-subscription creation failed — continuing");
            }
          }
        } else if (merchant && !row.lifeosTransaction.merchantId) {
          await prisma.transaction.update({
            where: { id: row.lifeosTransaction.id },
            data: { merchantId: merchant.id },
          });
        }
      }),
    );

    // Report progress for long-running jobs
    await job.updateProgress(Math.round(((i + batch.length) / rows.length) * 100));
  }

  logger.info(
    { analyzed: rows.length, updated },
    "recategorize completed",
  );
};

export const startRecategorizeBankWorker = (): Worker<RecategorizeBankJob> => {
  const worker = new Worker<RecategorizeBankJob>(
    "recategorize-bank",
    async (job) => {
      logger.info(
        { userId: job.data.userId, accountId: job.data.accountId },
        "recategorize-bank started",
      );
      try {
        await recategorize(job);
      } catch (err) {
        logger.error({ err }, "recategorize-bank failed");
        throw err;
      }
    },
    { connection, concurrency: 1 },
  );
  return worker;
};
