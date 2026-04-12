// ============================================================================
// @lifeos/ocr — OCR abstraction
// ----------------------------------------------------------------------------
// Pluggable provider interface. Default impl: tesseract.js (runs locally).
// Swap via OCR_PROVIDER env — textract and google-vision providers are
// wired but marked unavailable until SDK deps are added.
// ============================================================================

import { env } from "@lifeos/config";
import pdfParse from "pdf-parse";
import { createWorker } from "tesseract.js";

export interface OcrResult {
  text: string;
  language: string | null;
  confidence: number | null;
  rawProviderData?: unknown;
}

export interface OcrProvider {
  name: string;
  extract(buffer: Buffer, mimeType: string): Promise<OcrResult>;
}

// ----------------------------------------------------------------------------
// Tesseract provider
// ----------------------------------------------------------------------------

const TESSERACT_LANGS = "eng+deu+fra+ara";

/**
 * Extract text from a PDF directly. Most German payslips, bank statements,
 * and invoices have embedded text, so this is both faster and more accurate
 * than OCR. Falls back gracefully if the PDF is image-only.
 */
const extractPdfText = async (buffer: Buffer): Promise<OcrResult> => {
  const result = await pdfParse(buffer);
  return {
    text: result.text.trim(),
    language: null,
    confidence: result.text.trim().length > 10 ? 1 : 0,
  };
};

class TesseractProvider implements OcrProvider {
  name = "tesseract";

  async extract(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    // PDFs: use pdf-parse first. Tesseract can't read PDFs directly.
    if (mimeType === "application/pdf" || looksLikePdf(buffer)) {
      try {
        const pdfResult = await extractPdfText(buffer);
        if (pdfResult.text.length > 10) return pdfResult;
        // If the PDF has no extractable text (image-only scan), we'd need
        // pdf-to-image conversion (pdf2pic / poppler). Not supported here —
        // return the (possibly empty) result and let the caller deal with it.
        return pdfResult;
      } catch (err) {
        throw new Error(
          `Failed to read PDF: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Images: hand off to tesseract.
    const worker = await createWorker(TESSERACT_LANGS);
    try {
      const {
        data: { text, confidence },
      } = await worker.recognize(buffer);
      return {
        text: text.trim(),
        language: null,
        confidence: typeof confidence === "number" ? confidence / 100 : null,
      };
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  }
}

const looksLikePdf = (buffer: Buffer): boolean =>
  buffer.length >= 5 && buffer.slice(0, 5).toString("ascii") === "%PDF-";

// ----------------------------------------------------------------------------
// Cloud providers (stubs — production hosts plug in their own SDKs)
// ----------------------------------------------------------------------------

class StubProvider implements OcrProvider {
  constructor(public name: string) {}

  async extract(): Promise<OcrResult> {
    throw new Error(
      `OCR provider "${this.name}" is not installed in this build`,
    );
  }
}

// ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------

let cached: OcrProvider | null = null;

export const getOcrProvider = (): OcrProvider => {
  if (cached) return cached;
  switch (env.OCR_PROVIDER) {
    case "tesseract":
      cached = new TesseractProvider();
      break;
    case "textract":
      cached = new StubProvider("textract");
      break;
    case "google-vision":
      cached = new StubProvider("google-vision");
      break;
  }
  return cached!;
};

// ----------------------------------------------------------------------------
// Extraction helpers (heuristics applied to OCR text)
// ----------------------------------------------------------------------------

export interface ExtractedFields {
  amountMinor?: number;
  currency?: string;
  date?: string; // ISO
  merchantGuess?: string;
  vatAmountMinor?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  $: "USD",
  "£": "GBP",
  "CHF": "CHF",
};

const TOTAL_HINT = /(?:total|summe|gesamt|betrag|montant|المجموع)[^\d-]{0,20}(-?\d{1,6}[.,]\d{2})/i;
const DATE_HINT =
  /\b(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{2,4})\b/;

const parseAmount = (raw: string): number | undefined => {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  if (Number.isNaN(n)) return undefined;
  return Math.round(n * 100);
};

export const extractFields = (text: string): ExtractedFields => {
  const out: ExtractedFields = {};

  for (const [symbol, iso] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) {
      out.currency = iso;
      break;
    }
  }

  const totalMatch = text.match(TOTAL_HINT);
  if (totalMatch?.[1]) {
    const amt = parseAmount(totalMatch[1]);
    if (amt !== undefined) out.amountMinor = amt;
  }

  const dateMatch = text.match(DATE_HINT);
  if (dateMatch) {
    const raw = dateMatch[1]!;
    if (/^\d{4}-/.test(raw)) {
      out.date = raw;
    } else {
      const parts = raw.split(/[./]/).map((p) => Number.parseInt(p, 10));
      if (parts.length === 3) {
        const [d, m, y] = parts as [number, number, number];
        const year = y < 100 ? 2000 + y : y;
        out.date = `${year.toString().padStart(4, "0")}-${m
          .toString()
          .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
      }
    }
  }

  const firstLine = text.split("\n").find((l) => l.trim().length > 2);
  if (firstLine) out.merchantGuess = firstLine.trim().slice(0, 60);

  return out;
};
