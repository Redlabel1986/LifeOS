// ============================================================================
// worker/jobs/process-document
// ----------------------------------------------------------------------------
// 1. Fetches the document record
// 2. Downloads the file from S3
// 3. Runs OCR
// 4. Extracts structured fields (amount, date, merchant guess)
// 5. Runs AI summary + tags
// 6. Matches to a known merchant via regex patterns
// 7. Updates the document row
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
import { Worker, type Job } from "bullmq";
import { connection, type ProcessDocumentJob } from "../queue.js";
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

const matchMerchant = async (
  ocrText: string,
): Promise<Merchant | null> => {
  const merchants = await prisma.merchant.findMany();
  const haystack = ocrText.toLowerCase();
  for (const m of merchants) {
    for (const pattern of m.patterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(haystack)) return m;
      } catch {
        if (haystack.includes(pattern.toLowerCase())) return m;
      }
    }
  }
  return null;
};

const detectLanguage = (text: string): string | null => {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  const lower = text.toLowerCase();
  if (/\b(der|die|das|und|rechnung|summe|gesamt)\b/.test(lower)) return "de";
  if (/\b(facture|total|montant|tva)\b/.test(lower)) return "fr";
  if (/\b(the|invoice|total|amount|vat)\b/.test(lower)) return "en";
  return null;
};

const processDocument = async (doc: Document): Promise<void> => {
  const stream = await getObjectStream(doc.storageKey);
  const buffer = await readStreamToBuffer(stream);

  const provider = getOcrProvider();
  const ocr = await provider.extract(buffer, doc.mimeType);
  const language = ocr.language ?? detectLanguage(ocr.text);
  const extracted = extractFields(ocr.text);

  let summary: string | null = null;
  let aiTags: string[] = [];
  try {
    const ai = await summarizeDocument({
      ocrText: ocr.text,
      locale: (language ?? "en") as AiLocale,
    });
    summary = ai.summary || null;
    aiTags = ai.tags;
  } catch (err) {
    logger.warn({ err }, "AI summarization failed — continuing without it");
  }

  const merchant = await matchMerchant(ocr.text);

  // Payslips get a dedicated structured extraction instead of the generic one.
  let extractedBlob: Prisma.InputJsonValue;
  if (doc.type === DocumentType.PAYSLIP) {
    try {
      const payslip = await extractPayslip(ocr.text);
      extractedBlob = {
        kind: "payslip",
        payslip: (payslip ?? null) as unknown as Prisma.InputJsonValue,
        fallback: {
          amountMinor: extracted.amountMinor ?? null,
          currency: extracted.currency ?? null,
          date: extracted.date ?? null,
        },
      } as unknown as Prisma.InputJsonValue;
    } catch (err) {
      logger.warn({ err }, "payslip extraction failed — keeping fallback");
      extractedBlob = {
        kind: "payslip",
        payslip: null,
        fallback: {
          amountMinor: extracted.amountMinor ?? null,
          currency: extracted.currency ?? null,
          date: extracted.date ?? null,
        },
      } as unknown as Prisma.InputJsonValue;
    }
  } else {
    extractedBlob = {
      kind: "generic",
      amountMinor: extracted.amountMinor ?? null,
      currency: extracted.currency ?? null,
      date: extracted.date ?? null,
      merchantGuess: extracted.merchantGuess ?? null,
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
};

export const startProcessDocumentWorker = (): Worker<ProcessDocumentJob> => {
  const worker = new Worker<ProcessDocumentJob>(
    "process-document",
    async (job: Job<ProcessDocumentJob>) => {
      const doc = await prisma.document.findUnique({
        where: { id: job.data.documentId },
      });
      if (!doc) {
        logger.warn({ id: job.data.documentId }, "document not found");
        return;
      }
      logger.info({ id: doc.id }, "processing document");
      try {
        await processDocument(doc);
        logger.info({ id: doc.id }, "document processed");
      } catch (err) {
        logger.error({ err, id: doc.id }, "document processing failed");
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: DocumentStatus.FAILED },
        });
        throw err;
      }
    },
    { connection, concurrency: 2 },
  );
  return worker;
};
