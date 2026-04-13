// ============================================================================
// Nuxt Server Route — POST /api/analyze-bank
// ----------------------------------------------------------------------------
// Runs bank transaction categorization synchronously with SSE progress.
// Replaces the queued GraphQL mutation which doesn't work on Vercel serverless.
// ============================================================================

import { verifyAccessToken } from "@lifeos/api/auth/tokens";
import { categorizeTransaction } from "@lifeos/ai";
import { prisma, Prisma } from "@lifeos/db";

export default defineEventHandler(async (event) => {
  // ---- Auth ----------------------------------------------------------------
  const authHeader = getHeader(event, "authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    throw createError({ statusCode: 401, statusMessage: "Invalid token" });
  }

  // ---- Parse body ----------------------------------------------------------
  const body = await readBody<{ accountId?: string; force?: boolean }>(event);
  const accountId = body?.accountId;
  const force = body?.force ?? false;

  if (accountId) {
    const owned = await prisma.bankAccount.findFirst({
      where: { id: accountId, connection: { userId: claims.sub } },
    });
    if (!owned) {
      throw createError({ statusCode: 404, statusMessage: "Account not found" });
    }
  }

  // ---- Set up SSE stream ---------------------------------------------------
  const stream = createEventStream(event);

  const send = async (data: Record<string, unknown>) => {
    await stream.push({ data: JSON.stringify(data) });
  };

  // ---- Run analysis in background while streaming --------------------------
  (async () => {
    try {
      // Find transactions to analyze
      const bankTxWhere: Prisma.BankTransactionWhereInput = accountId
        ? { accountId }
        : { account: { connection: { userId: claims.sub } } };

      const txFilter: Prisma.TransactionWhereInput = force
        ? {
            userId: claims.sub,
            OR: [
              { categoryId: null },
              { aiConfidence: { not: null } },
              { needsReview: true },
            ],
          }
        : {
            userId: claims.sub,
            OR: [{ categoryId: null }, { needsReview: true }],
          };

      const rows = await prisma.bankTransaction.findMany({
        where: { ...bankTxWhere, lifeosTransaction: txFilter },
        include: { lifeosTransaction: true },
      });

      const total = rows.length;
      await send({ type: "start", total });

      if (total === 0) {
        await send({ type: "done", analyzed: 0, updated: 0 });
        await stream.close();
        return;
      }

      // Load merchants + categories once
      const merchants = await prisma.merchant.findMany();
      const cats = await prisma.category.findMany({
        where: { OR: [{ userId: claims.sub }, { isSystem: true }] },
        select: { id: true, slug: true, kind: true },
      });

      let updated = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.lifeosTransaction) continue;

        const haystack = [row.counterpartyName, row.remittanceInfo]
          .filter(Boolean)
          .join(" ");

        if (haystack) {
          // Merchant matching
          const merchant = matchMerchant(haystack, merchants);
          let categoryId: string | null = row.lifeosTransaction.categoryId;
          let aiConfidence: number | null = row.lifeosTransaction.aiConfidence;

          // AI categorization
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
              const matched = cats.find(
                (c) => c.slug === result.categorySlug,
              );
              if (matched) {
                categoryId = matched.id;
                aiConfidence = result.confidence;
              }
            }
          } catch {
            // AI failed — continue
          }

          // Merchant fallback
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
            updated++;
          } else if (merchant && !row.lifeosTransaction.merchantId) {
            await prisma.transaction.update({
              where: { id: row.lifeosTransaction.id },
              data: { merchantId: merchant.id },
            });
          }
        }

        // Send progress every transaction
        await send({
          type: "progress",
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          updated,
        });
      }

      await send({ type: "done", analyzed: total, updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await send({ type: "error", message: msg });
    } finally {
      await stream.close();
    }
  })();

  return stream.send();
});

// ---------------------------------------------------------------------------
// Merchant matching (inlined to avoid cross-package import issues)
// ---------------------------------------------------------------------------

function matchMerchant(
  text: string,
  merchants: { id: string; displayName: string; patterns: string[]; defaultCategorySlug: string | null }[],
) {
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
}
