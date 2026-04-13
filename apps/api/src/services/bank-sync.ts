// ============================================================================
// apps/api — bank sync service
// ----------------------------------------------------------------------------
// Pulls fresh BankTransactions from a provider, deduplicates them by
// (accountId, externalId), and creates corresponding LifeOS Transactions
// with merchant and category guesses.
//
// Reused logic from the document worker:
//   * Merchant matching via Merchant.patterns regex
//   * AI categorization (best-effort, falls back if no key)
// ============================================================================

import { categorizeTransaction } from "@lifeos/ai";
import {
  parseCamt053,
  type BankTransactionRecord,
} from "@lifeos/banking";
import {
  Prisma,
  TransactionSource,
  TransactionType,
  prisma,
  type BankAccount,
  type BankConnection,
  type Merchant,
} from "@lifeos/db";
import { getGoCardlessProvider } from "@lifeos/banking";
import { logger } from "../logger.js";

interface SyncResult {
  newTransactions: number;
  totalScanned: number;
  errors: string[];
}

// ----------------------------------------------------------------------------
// Merchant + category resolution (shared with document worker)
// ----------------------------------------------------------------------------

let merchantCache: Merchant[] | null = null;
const getMerchants = async (): Promise<Merchant[]> => {
  if (merchantCache) return merchantCache;
  merchantCache = await prisma.merchant.findMany();
  return merchantCache;
};

const matchMerchant = (text: string, merchants: Merchant[]): Merchant | null => {
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

// ----------------------------------------------------------------------------
// Per-record import
// ----------------------------------------------------------------------------

const importRecord = async (
  account: BankAccount & { connection: BankConnection },
  record: BankTransactionRecord,
  options?: { skipAi?: boolean },
): Promise<{ created: boolean }> => {
  // Dedupe: same (accountId, externalId) means we already imported it.
  const existing = await prisma.bankTransaction.findUnique({
    where: {
      accountId_externalId: {
        accountId: account.id,
        externalId: record.externalId,
      },
    },
  });
  if (existing) return { created: false };

  const merchants = await getMerchants();
  const haystack = [record.counterpartyName, record.remittanceInfo]
    .filter(Boolean)
    .join(" ");
  const merchant = haystack ? matchMerchant(haystack, merchants) : null;

  // 1. Rule-based: merchant → defaultCategorySlug (free, instant)
  let categoryId: string | null = null;
  let aiConfidence: number | null = null;

  if (merchant?.defaultCategorySlug) {
    const fallback = await prisma.category.findFirst({
      where: { slug: merchant.defaultCategorySlug, isSystem: true },
      select: { id: true },
    });
    if (fallback) {
      categoryId = fallback.id;
      aiConfidence = 1.0;
    }
  }

  // 2. AI fallback: only if no merchant rule matched (skip in bulk imports)
  if (!categoryId && !options?.skipAi) {
    try {
      const cats = await prisma.category.findMany({
        where: {
          OR: [
            { userId: account.connection.userId },
            { isSystem: true },
          ],
          kind: record.amountMinor < 0n ? "EXPENSE" : "INCOME",
        },
        select: { id: true, slug: true },
      });
      if (cats.length > 0 && haystack) {
        const result = await categorizeTransaction({
          description: record.remittanceInfo ?? "",
          merchantName: record.counterpartyName ?? merchant?.displayName ?? null,
          amountMajor: Number(record.amountMinor) / 100,
          currency: record.currency,
          availableSlugs: cats.map((c) => c.slug),
        });
        const matchedCat = cats.find((c) => c.slug === result.categorySlug);
        if (matchedCat) {
          categoryId = matchedCat.id;
          aiConfidence = result.confidence;
        }
      }
    } catch (err) {
      logger.warn({ err }, "AI categorization failed for bank tx — continuing");
    }
  }

  const isExpense = record.amountMinor < 0n;
  const amountAbs = isExpense ? -record.amountMinor : record.amountMinor;

  // Create both rows in a transaction so the link is always consistent.
  await prisma.$transaction(async (tx) => {
    const lifeosTx = await tx.transaction.create({
      data: {
        userId: account.connection.userId,
        type: isExpense ? TransactionType.EXPENSE : TransactionType.INCOME,
        source: TransactionSource.BANK_IMPORT,
        amountMinor: amountAbs,
        currency: record.currency,
        occurredAt: record.bookingDate,
        bookedAt: record.bookingDate,
        description:
          record.counterpartyName ??
          record.remittanceInfo?.slice(0, 120) ??
          null,
        note: record.remittanceInfo,
        categoryId,
        merchantId: merchant?.id ?? null,
        aiConfidence,
        needsReview: !categoryId,
      },
    });

    await tx.bankTransaction.create({
      data: {
        accountId: account.id,
        externalId: record.externalId,
        amountMinor: record.amountMinor,
        currency: record.currency,
        bookingDate: record.bookingDate,
        valueDate: record.valueDate,
        remittanceInfo: record.remittanceInfo,
        counterpartyName: record.counterpartyName,
        counterpartyIban: record.counterpartyIban,
        endToEndId: record.endToEndId,
        raw: record.raw as Prisma.InputJsonValue,
        lifeosTransactionId: lifeosTx.id,
      },
    });
  });

  return { created: true };
};

// ----------------------------------------------------------------------------
// Public sync APIs
// ----------------------------------------------------------------------------

export const syncGoCardlessAccount = async (
  accountId: string,
): Promise<SyncResult> => {
  const account = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: accountId },
    include: { connection: true },
  });

  const provider = getGoCardlessProvider();
  const lastSync = account.connection.lastSyncedAt;

  let records: BankTransactionRecord[];
  try {
    records = await provider.fetchTransactions({
      connectionRef: {
        requisitionId: account.connection.requisitionId,
        institutionId: account.connection.institutionId,
      },
      accountExternalId: account.externalId,
      since: lastSync,
    });
  } catch (err) {
    await prisma.bankConnection.update({
      where: { id: account.connection.id },
      data: { errorMessage: String(err), status: "ERROR" },
    });
    throw err;
  }

  let created = 0;
  const errors: string[] = [];
  for (const record of records) {
    try {
      const result = await importRecord(account, record);
      if (result.created) created += 1;
    } catch (err) {
      errors.push(`${record.externalId}: ${String(err)}`);
    }
  }

  await prisma.bankConnection.update({
    where: { id: account.connection.id },
    data: {
      lastSyncedAt: new Date(),
      errorMessage: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      status: errors.length === records.length && records.length > 0 ? "ERROR" : "ACTIVE",
    },
  });

  return { newTransactions: created, totalScanned: records.length, errors };
};

/**
 * Re-runs merchant matching + AI categorization on bank-imported transactions.
 *
 * - `force: false` (default) — only transactions that are still uncategorized
 *   or flagged for review. Safe: never overwrites a manual categorization.
 * - `force: true` — retroactively re-analyze ALL bank-imported transactions,
 *   including ones that already have AI-assigned categories. Manual-set
 *   categories are still preserved (tracked via `Transaction.note` marker or
 *   implicit via the API's categorizeTransaction mutation clearing
 *   `aiConfidence`).
 */
export const recategorizeBankAccount = async (input: {
  userId: string;
  accountId?: string;
  force?: boolean;
}): Promise<{ analyzed: number; updated: number }> => {
  const bankTxWhere: Prisma.BankTransactionWhereInput = input.accountId
    ? { accountId: input.accountId }
    : { account: { connection: { userId: input.userId } } };

  // In force mode, only skip transactions the user has manually categorized.
  // A manual category is marked by aiConfidence being null AND a category set.
  const txFilter: Prisma.TransactionWhereInput = input.force
    ? {
        userId: input.userId,
        OR: [
          { categoryId: null },
          { aiConfidence: { not: null } }, // AI-set: safe to re-analyze
          { needsReview: true },
        ],
      }
    : {
        userId: input.userId,
        OR: [{ categoryId: null }, { needsReview: true }],
      };

  const rows = await prisma.bankTransaction.findMany({
    where: {
      ...bankTxWhere,
      lifeosTransaction: txFilter,
    },
    include: { lifeosTransaction: true },
  });

  if (rows.length === 0) return { analyzed: 0, updated: 0 };

  const merchants = await getMerchants();
  const cats = await prisma.category.findMany({
    where: { OR: [{ userId: input.userId }, { isSystem: true }] },
    select: { id: true, slug: true, kind: true },
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.lifeosTransaction) continue;

    const haystack = [row.counterpartyName, row.remittanceInfo]
      .filter(Boolean)
      .join(" ");
    if (!haystack) continue;

    const merchant = matchMerchant(haystack, merchants);
    let categoryId: string | null = row.lifeosTransaction.categoryId;
    let aiConfidence: number | null = row.lifeosTransaction.aiConfidence;

    try {
      const kind = row.amountMinor < 0n ? "EXPENSE" : "INCOME";
      const candidates = cats.filter((c) => c.kind === kind).map((c) => c.slug);
      if (candidates.length > 0) {
        const result = await categorizeTransaction({
          description: row.remittanceInfo ?? "",
          merchantName: row.counterpartyName ?? merchant?.displayName ?? null,
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

    if (!categoryId && merchant?.defaultCategorySlug) {
      const fallback = cats.find(
        (c) => c.slug === merchant.defaultCategorySlug,
      );
      if (fallback) categoryId = fallback.id;
    }

    if (categoryId) {
      await prisma.transaction.update({
        where: { id: row.lifeosTransaction.id },
        data: {
          categoryId,
          merchantId: merchant?.id ?? row.lifeosTransaction.merchantId,
          aiConfidence,
          needsReview: false,
        },
      });
      updated += 1;
    } else if (merchant && !row.lifeosTransaction.merchantId) {
      // At least record the merchant hit even if no category was picked.
      await prisma.transaction.update({
        where: { id: row.lifeosTransaction.id },
        data: { merchantId: merchant.id },
      });
    }
  }

  return { analyzed: rows.length, updated };
};

export const importCamtFile = async (input: {
  userId: string;
  xml: string;
  institutionName?: string;
}): Promise<{
  connectionId: string;
  accountId: string;
  result: SyncResult;
}> => {
  const parsed = parseCamt053(input.xml);

  // Find or create the connection: a CAMT connection is keyed by IBAN
  // (one logical "connection" per account file source).
  const connectionLabel =
    input.institutionName ??
    (parsed.account.iban ? `CAMT · ${parsed.account.iban}` : "CAMT Import");

  let connection = await prisma.bankConnection.findFirst({
    where: {
      userId: input.userId,
      provider: "CAMT_FILE",
      institutionName: connectionLabel,
    },
  });

  if (!connection) {
    connection = await prisma.bankConnection.create({
      data: {
        userId: input.userId,
        provider: "CAMT_FILE",
        status: "ACTIVE",
        institutionName: connectionLabel,
      },
    });
  }

  const externalId = parsed.account.iban ?? parsed.account.externalId;

  let account = await prisma.bankAccount.findUnique({
    where: {
      connectionId_externalId: {
        connectionId: connection.id,
        externalId,
      },
    },
  });

  if (!account) {
    account = await prisma.bankAccount.create({
      data: {
        connectionId: connection.id,
        externalId,
        iban: parsed.account.iban,
        bic: parsed.account.bic,
        name: parsed.account.name,
        ownerName: parsed.account.ownerName,
        currency: parsed.account.currency,
        balanceMinor: parsed.account.balanceMinor,
        balanceAt: parsed.account.balanceAt,
      },
    });
  } else if (parsed.account.balanceMinor !== null) {
    account = await prisma.bankAccount.update({
      where: { id: account.id },
      data: {
        balanceMinor: parsed.account.balanceMinor,
        balanceAt: parsed.account.balanceAt,
      },
    });
  }

  // ---- BULK IMPORT — optimized to fit within Vercel's 60s timeout ----------
  // Strategy:
  //   1. Sort newest-first so partial timeouts still preserve recent data
  //   2. Single dedup query for all existing externalIds
  //   3. Pre-load merchants once (already cached)
  //   4. Insert in parallel batches via Promise.all

  // Sort by booking date DESC (newest first)
  const sortedRecords = [...parsed.transactions].sort(
    (a, b) => b.bookingDate.getTime() - a.bookingDate.getTime(),
  );

  // Bulk dedup: fetch all existing externalIds in ONE query
  const allExternalIds = sortedRecords.map((r) => r.externalId);
  const existing = await prisma.bankTransaction.findMany({
    where: { accountId: account.id, externalId: { in: allExternalIds } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((e) => e.externalId));
  const newRecords = sortedRecords.filter((r) => !existingSet.has(r.externalId));

  // Pre-load merchants once
  const merchants = await getMerchants();
  // Pre-load system categories for merchant fallback
  const systemCategories = await prisma.category.findMany({
    where: { isSystem: true },
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(systemCategories.map((c) => [c.slug, c.id]));

  // Build all rows in memory (no DB calls)
  const transactionData = newRecords.map((record) => {
    const haystack = [record.counterpartyName, record.remittanceInfo]
      .filter(Boolean)
      .join(" ");
    const merchant = haystack ? matchMerchant(haystack, merchants) : null;
    const categoryId =
      merchant?.defaultCategorySlug
        ? categoryBySlug.get(merchant.defaultCategorySlug) ?? null
        : null;

    const isExpense = record.amountMinor < 0n;
    const amountAbs = isExpense ? -record.amountMinor : record.amountMinor;

    return {
      record,
      merchant,
      categoryId,
      isExpense,
      amountAbs,
    };
  });

  // Insert in parallel batches of 25 (avoids overwhelming Postgres)
  const BATCH_SIZE = 25;
  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < transactionData.length; i += BATCH_SIZE) {
    const batch = transactionData.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async ({ record, merchant, categoryId, isExpense, amountAbs }) => {
        await prisma.$transaction(async (tx) => {
          const lifeosTx = await tx.transaction.create({
            data: {
              userId: input.userId,
              type: isExpense ? TransactionType.EXPENSE : TransactionType.INCOME,
              source: TransactionSource.BANK_IMPORT,
              amountMinor: amountAbs,
              currency: record.currency,
              occurredAt: record.bookingDate,
              bookedAt: record.bookingDate,
              description:
                record.counterpartyName ??
                record.remittanceInfo?.slice(0, 120) ??
                null,
              note: record.remittanceInfo,
              categoryId,
              merchantId: merchant?.id ?? null,
              aiConfidence: categoryId ? 1.0 : null,
              needsReview: !categoryId,
            },
          });

          await tx.bankTransaction.create({
            data: {
              accountId: account.id,
              externalId: record.externalId,
              amountMinor: record.amountMinor,
              currency: record.currency,
              bookingDate: record.bookingDate,
              valueDate: record.valueDate,
              remittanceInfo: record.remittanceInfo,
              counterpartyName: record.counterpartyName,
              counterpartyIban: record.counterpartyIban,
              endToEndId: record.endToEndId,
              raw: record.raw as Prisma.InputJsonValue,
              lifeosTransactionId: lifeosTx.id,
            },
          });
        });
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j]!;
      if (r.status === "fulfilled") {
        created++;
      } else {
        errors.push(`${batch[j]!.record.externalId}: ${String(r.reason)}`);
      }
    }
  }

  await prisma.bankConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  });

  return {
    connectionId: connection.id,
    accountId: account.id,
    result: {
      newTransactions: created,
      totalScanned: parsed.transactions.length,
      errors,
    },
  };
};
