// ============================================================================
// apps/api — in-process document processor
// ----------------------------------------------------------------------------
// When a worker + Redis queue aren't available (dev mode), this runs the full
// OCR + AI pipeline inline in the API process. The worker ships the same
// logic and will be used in production.
//
// Pipeline:
//   1. Download bytes from S3 via storage adapter
//   2. OCR with the configured provider
//   3. Detect language + extract naive fields (amount, date, merchant guess)
//   4. If PAYSLIP → run structured `extractPayslip` via LLM
//      otherwise → run generic `summarizeDocument`
//   5. Match global `Merchant` patterns against the OCR text
//   6. Update the Document row
// ============================================================================

import {
  extractPayslip,
  summarizeDocument,
  type Locale as AiLocale,
} from "@lifeos/ai";
import {
  DocumentStatus,
  DocumentType,
  Prisma,
  prisma,
  type Document,
  type Merchant,
} from "@lifeos/db";
import { extractFields, getOcrProvider } from "@lifeos/ocr";
import { getObjectStream } from "@lifeos/storage";
import { logger } from "../logger.js";

const readStreamToBuffer = async (stream: unknown): Promise<Buffer> => {
  if (!stream) throw new Error("Empty storage stream");
  const chunks: Uint8Array[] = [];
  const reader = stream as AsyncIterable<Uint8Array>;
  for await (const chunk of reader) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const detectLanguage = (text: string): string | null => {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  const lower = text.toLowerCase();
  if (/\b(der|die|das|und|rechnung|summe|gesamt|brutto|netto|lohnsteuer)\b/.test(lower))
    return "de";
  if (/\b(facture|total|montant|tva)\b/.test(lower)) return "fr";
  if (/\b(the|invoice|total|amount|vat)\b/.test(lower)) return "en";
  return null;
};

const matchMerchant = async (ocrText: string): Promise<Merchant | null> => {
  const merchants = await prisma.merchant.findMany();
  const haystack = ocrText.toLowerCase();
  for (const m of merchants) {
    for (const pattern of m.patterns) {
      try {
        if (new RegExp(pattern, "i").test(ocrText)) return m;
      } catch {
        if (haystack.includes(pattern.toLowerCase())) return m;
      }
    }
  }
  return null;
};

/**
 * Process a single document end-to-end. Safe to call from an API resolver or
 * from a background worker — pulls the document row fresh, updates status.
 * Errors are swallowed and reflected as FAILED on the row.
 */
export const processDocument = async (documentId: string): Promise<void> => {
  const doc: Document | null = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!doc) {
    logger.warn({ documentId }, "processDocument: document not found");
    return;
  }

  try {
    const stream = await getObjectStream(doc.storageKey);
    const buffer = await readStreamToBuffer(stream);

    const provider = getOcrProvider();
    const ocr = await provider.extract(buffer, doc.mimeType);
    const language = ocr.language ?? detectLanguage(ocr.text);
    const basicExtract = extractFields(ocr.text);

    let summary: string | null = null;
    let aiTags: string[] = [];
    let extractedBlob: Prisma.InputJsonValue;

    if (doc.type === DocumentType.PAYSLIP) {
      // Payslip: structured field extraction only, no free-form summary.
      let payslip: Awaited<ReturnType<typeof extractPayslip>> = null;
      try {
        payslip = await extractPayslip(ocr.text);
      } catch (err) {
        logger.warn({ err, documentId }, "payslip extraction failed");
      }
      extractedBlob = {
        kind: "payslip",
        payslip: payslip as unknown as Prisma.InputJsonValue,
        fallback: {
          amountMinor: basicExtract.amountMinor ?? null,
          currency: basicExtract.currency ?? null,
          date: basicExtract.date ?? null,
        },
      } as unknown as Prisma.InputJsonValue;
    } else {
      // Generic documents: free-form AI summary + tags.
      try {
        const ai = await summarizeDocument({
          ocrText: ocr.text,
          locale: (language ?? "en") as AiLocale,
        });
        summary = ai.summary || null;
        aiTags = ai.tags;
      } catch (err) {
        logger.warn({ err, documentId }, "summary failed — continuing");
      }
      const merchant = await matchMerchant(ocr.text);
      extractedBlob = {
        kind: "generic",
        amountMinor: basicExtract.amountMinor ?? null,
        currency: basicExtract.currency ?? null,
        date: basicExtract.date ?? null,
        merchantGuess: basicExtract.merchantGuess ?? null,
        matchedMerchantId: merchant?.id ?? null,
      } as unknown as Prisma.InputJsonValue;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: DocumentStatus.PROCESSED,
        processedAt: new Date(),
        language,
        ocrText: ocr.text,
        ocrData: { confidence: ocr.confidence } as Prisma.InputJsonValue,
        extracted: extractedBlob,
        summary,
        aiTags,
      },
    });
    logger.info({ documentId, type: doc.type }, "document processed");
  } catch (err) {
    logger.error({ err, documentId }, "document processing failed");
    await prisma.document
      .update({
        where: { id: doc.id },
        data: { status: DocumentStatus.FAILED },
      })
      .catch(() => undefined);
  }
};
