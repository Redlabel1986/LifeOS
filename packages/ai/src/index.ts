// ============================================================================
// @lifeos/ai — LLM abstraction (Anthropic + OpenAI)
// ----------------------------------------------------------------------------
// Provider selection (in order of preference):
//   1. Anthropic (Claude) if ANTHROPIC_API_KEY is set
//   2. OpenAI (or any OpenAI-compatible gateway) if OPENAI_API_KEY is set
//   3. Noop fallback that returns deterministic placeholders
//
// The Anthropic adapter uses the official @anthropic-ai/sdk and applies
// prompt caching to the categorization system prompt — that one prompt is
// reused for every bank transaction, so caching cuts cost ~90% on repeats.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@lifeos/config";
import OpenAI from "openai";

export type Locale = "de" | "en" | "fr" | "ar";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  tokensIn?: number;
  tokensOut?: number;
}

interface ChatOptions {
  temperature?: number;
  /**
   * If set, the system message is wired with prompt caching (Anthropic) so
   * that repeated calls with the same system text reuse the cached prefix.
   */
  cacheSystem?: boolean;
}

interface AiProvider {
  readonly name: "anthropic" | "openai" | "noop";
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
}

// ----------------------------------------------------------------------------
// Anthropic provider
// ----------------------------------------------------------------------------

class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<ChatResult> {
    const systemTexts = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content);
    const turn = messages.filter((m) => m.role !== "system");

    const systemBlocks =
      systemTexts.length > 0
        ? systemTexts.map((text, idx) => ({
            type: "text" as const,
            text,
            ...(opts.cacheSystem && idx === systemTexts.length - 1
              ? { cache_control: { type: "ephemeral" as const } }
              : {}),
          }))
        : undefined;

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      temperature: opts.temperature ?? 0.3,
      system: systemBlocks,
      messages: turn.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return {
      content: textBlock?.text ?? "",
      tokensIn:
        res.usage.input_tokens +
        (res.usage.cache_read_input_tokens ?? 0) +
        (res.usage.cache_creation_input_tokens ?? 0),
      tokensOut: res.usage.output_tokens,
    };
  }
}

// ----------------------------------------------------------------------------
// OpenAI provider
// ----------------------------------------------------------------------------

class OpenAIProvider implements AiProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(
    apiKey: string,
    baseURL: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async chat(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<ChatResult> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0.3,
      messages,
    });
    return {
      content: res.choices[0]?.message.content ?? "",
      tokensIn: res.usage?.prompt_tokens,
      tokensOut: res.usage?.completion_tokens,
    };
  }
}

// ----------------------------------------------------------------------------
// Noop provider — returns deterministic placeholders
// ----------------------------------------------------------------------------

class NoopProvider implements AiProvider {
  readonly name = "noop" as const;
  async chat(): Promise<ChatResult> {
    return {
      content:
        "[AI is not configured: set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env]",
    };
  }
}

// ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------

let cached: AiProvider | null = null;

const getProvider = (): AiProvider => {
  if (cached) return cached;
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.length > 10) {
    cached = new AnthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
  } else if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 10) {
    cached = new OpenAIProvider(
      env.OPENAI_API_KEY,
      env.OPENAI_BASE_URL,
      env.OPENAI_MODEL,
    );
  } else {
    cached = new NoopProvider();
  }
  return cached;
};

export const isAiConfigured = (): boolean => getProvider().name !== "noop";
export const aiProviderName = (): string => getProvider().name;

// ----------------------------------------------------------------------------
// Low-level chat
// ----------------------------------------------------------------------------

export const chat = async (
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> => {
  return getProvider().chat(messages, opts);
};

const localeName = (l: Locale): string =>
  ({ de: "German", en: "English", fr: "French", ar: "Arabic" })[l];

// ----------------------------------------------------------------------------
// Transaction categorization (structured JSON, prompt-cached system)
// ----------------------------------------------------------------------------

export interface CategorizationResult {
  categorySlug: string | null;
  confidence: number;
  reasoning?: string;
}

const CATEGORIZATION_SYSTEM = `You are a personal finance assistant that categorizes bank transactions for a German user.

Reply with ONLY a JSON object (no markdown, no prose) of the form:
{"slug": "<one-of-the-provided-slugs-or-null>", "confidence": <0..1>}

Rules:
- The slug MUST be one of the provided list, exactly as given. Never invent slugs.
- If you are uncertain, return {"slug": null, "confidence": 0}.
- Common patterns:
  * Supermarkets (REWE, Lidl, Aldi, Edeka, Wolt, Kaufland, Penny, Netto): "groceries"
  * Restaurants and food delivery (Block House, Lieferando, Uber Eats, McDonald's): "dining"
  * Streaming and digital subscriptions (Netflix, Spotify, Disney+, WOW, Sky, YouTube Premium): "subscriptions"
  * Public transport, gas stations, taxi, Deutsche Bahn, BVG: "transport"
  * Pharmacies, doctors, hospitals, fitness studios: "health"
  * Rent payments, Hausverwaltung, Vermieter: "rent"
  * Utilities: Stadtwerke, Vattenfall, E.ON, Internet (Telekom, Vodafone, 1&1): "utilities"
  * Insurance: Allianz, AXA, HUK, DEVK: "insurance"
- Use the merchant name as the strongest signal, then the description.`;

export const categorizeTransaction = async (input: {
  description: string;
  merchantName?: string | null;
  amountMajor: number;
  currency: string;
  availableSlugs: string[];
}): Promise<CategorizationResult> => {
  if (!isAiConfigured() || input.availableSlugs.length === 0) {
    return { categorySlug: null, confidence: 0 };
  }
  const userPrompt = `Transaction:
- merchant: ${input.merchantName ?? "unknown"}
- description: ${input.description || "(none)"}
- amount: ${input.amountMajor} ${input.currency}

Available category slugs: ${input.availableSlugs.join(", ")}

Reply with the JSON object only.`;

  const res = await chat(
    [
      { role: "system", content: CATEGORIZATION_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0, cacheSystem: true },
  );

  // Some models wrap JSON in code fences — strip them defensively.
  const cleaned = res.content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      slug?: string | null;
      confidence?: number;
    };
    const slug =
      parsed.slug && input.availableSlugs.includes(parsed.slug)
        ? parsed.slug
        : null;
    return {
      categorySlug: slug,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
    };
  } catch {
    return { categorySlug: null, confidence: 0 };
  }
};

// ----------------------------------------------------------------------------
// Payslip extraction (German "Gehaltsnachweis")
// ----------------------------------------------------------------------------

export interface PayslipExtraction {
  periodStart: string | null; // ISO date
  periodEnd: string | null; // ISO date
  currency: string;
  gross: number | null; // Bruttogehalt (major units)
  net: number | null; // Nettogehalt (major units)
  incomeTax: number | null; // Lohnsteuer
  solidarityTax: number | null; // Solidaritätszuschlag
  churchTax: number | null; // Kirchensteuer
  pensionInsurance: number | null; // Rentenversicherung (AN-Anteil)
  healthInsurance: number | null; // Krankenversicherung (AN-Anteil)
  unemploymentInsurance: number | null; // Arbeitslosenversicherung (AN-Anteil)
  careInsurance: number | null; // Pflegeversicherung (AN-Anteil)
  yearToDate: {
    gross: number | null;
    net: number | null;
    incomeTax: number | null;
  } | null;
  employerName: string | null;
  raw: unknown;
}

const PAYSLIP_SYSTEM = `You are an expert at extracting structured data from German payslips ("Gehaltsnachweis" / "Lohn- und Gehaltsabrechnung").

Extract the following fields from the OCR text. All monetary values are in major units (e.g. 2500.00 for 2500 EUR). Return valid JSON with this exact schema — no prose, no markdown:

{
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "currency": "EUR",
  "gross": <number or null>,
  "net": <number or null>,
  "incomeTax": <number or null>,
  "solidarityTax": <number or null>,
  "churchTax": <number or null>,
  "pensionInsurance": <number or null>,
  "healthInsurance": <number or null>,
  "unemploymentInsurance": <number or null>,
  "careInsurance": <number or null>,
  "yearToDate": { "gross": <number or null>, "net": <number or null>, "incomeTax": <number or null> },
  "employerName": "<string or null>"
}

Field glossary (German terms in payslips):
- gross = Bruttolohn / Bruttobezüge / Gesamtbrutto (the total gross monthly pay)
- net = Auszahlungsbetrag / Nettoverdienst / Netto-Verdienst (the amount actually paid out)
- incomeTax = Lohnsteuer (LSt)
- solidarityTax = Solidaritätszuschlag (SolZ)
- churchTax = Kirchensteuer (KiSt / ev/rk)
- pensionInsurance = Rentenversicherung (RV) — ONLY the employee share (AN-Anteil), not the total
- healthInsurance = Krankenversicherung (KV) — employee share only
- unemploymentInsurance = Arbeitslosenversicherung (AV) — employee share only
- careInsurance = Pflegeversicherung (PV) — employee share only
- yearToDate = look for "Jahreswerte", "kumuliert", "YTD", "Gesamtjahr" columns
- employerName = the employer/company printed at the top of the statement

Rules:
- Use null for fields you cannot confidently read — NEVER guess.
- Parse German number format: "2.500,00" → 2500.00 (dot is thousands separator, comma is decimal).
- Employee share only for social security — if the payslip lists both AN-Anteil and AG-Anteil, use AN-Anteil.
- periodStart/periodEnd should span one calendar month for a monthly slip.`;

export const extractPayslip = async (
  ocrText: string,
): Promise<PayslipExtraction | null> => {
  if (!isAiConfigured()) return null;
  const res = await chat(
    [
      { role: "system", content: PAYSLIP_SYSTEM },
      { role: "user", content: ocrText.slice(0, 15000) },
    ],
    { temperature: 0, cacheSystem: true },
  );
  const cleaned = res.content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as PayslipExtraction;
    return { ...parsed, raw: cleaned };
  } catch {
    return null;
  }
};

// ----------------------------------------------------------------------------
// Document summary (locale-aware)
// ----------------------------------------------------------------------------

export const summarizeDocument = async (input: {
  ocrText: string;
  locale: Locale;
}): Promise<{ summary: string; tags: string[] }> => {
  if (!isAiConfigured()) {
    return { summary: "", tags: [] };
  }
  const system = `You are a document analyst. Summarize the document in ${localeName(
    input.locale,
  )} in at most 3 sentences. Then extract 3-6 short tags (single words).
Reply with valid JSON only: {"summary": "...", "tags": ["...", "..."]}`;
  const res = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: input.ocrText.slice(0, 8000) },
    ],
    { temperature: 0.2 },
  );
  try {
    const cleaned = res.content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      summary?: string;
      tags?: string[];
    };
    return {
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    };
  } catch {
    return { summary: res.content.slice(0, 400), tags: [] };
  }
};

// ----------------------------------------------------------------------------
// Cancellation email draft (locale-aware)
// ----------------------------------------------------------------------------

const FALLBACK_DRAFTS: Record<
  Locale,
  (name: string, customer: string) => { subject: string; body: string }
> = {
  de: (name, customer) => ({
    subject: `Kündigung: ${name}`,
    body: `Sehr geehrte Damen und Herren,\n\nhiermit kündige ich meinen Vertrag "${name}" fristgerecht zum nächstmöglichen Termin.\n\nBitte bestätigen Sie die Kündigung schriftlich.\n\nMit freundlichen Grüßen\n${customer}`,
  }),
  en: (name, customer) => ({
    subject: `Cancellation: ${name}`,
    body: `Dear Sir or Madam,\n\nI hereby cancel my subscription "${name}" effective at the earliest possible date.\n\nPlease confirm the cancellation in writing.\n\nKind regards,\n${customer}`,
  }),
  fr: (name, customer) => ({
    subject: `Résiliation : ${name}`,
    body: `Madame, Monsieur,\n\nPar la présente, je résilie mon abonnement "${name}" à la prochaine échéance possible.\n\nJe vous prie de bien vouloir me confirmer cette résiliation par écrit.\n\nCordialement,\n${customer}`,
  }),
  ar: (name, customer) => ({
    subject: `إلغاء الاشتراك: ${name}`,
    body: `تحية طيبة وبعد،\n\nأودّ إلغاء اشتراكي "${name}" في أقرب موعد ممكن.\n\nيرجى تأكيد الإلغاء كتابياً.\n\nمع خالص التحية،\n${customer}`,
  }),
};

export const draftCancellationEmail = async (input: {
  subscriptionName: string;
  customerName?: string | null;
  cancellationDeadline?: Date | null;
  locale: Locale;
}): Promise<{ subject: string; body: string }> => {
  if (!isAiConfigured()) {
    return FALLBACK_DRAFTS[input.locale](
      input.subscriptionName,
      input.customerName ?? "",
    );
  }
  const system = `You are a legal writing assistant. Draft a formal subscription cancellation email in ${localeName(
    input.locale,
  )}. Keep it polite, concise, and legally valid. Reply with valid JSON only: {"subject": "...", "body": "..."}`;
  const user = `Subscription: ${input.subscriptionName}
Customer name: ${input.customerName ?? "-"}
Cancellation deadline: ${input.cancellationDeadline?.toISOString() ?? "earliest possible"}`;
  try {
    const res = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.4 },
    );
    const cleaned = res.content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      subject?: string;
      body?: string;
    };
    return {
      subject: parsed.subject ?? `Cancellation: ${input.subscriptionName}`,
      body: parsed.body ?? "",
    };
  } catch {
    return FALLBACK_DRAFTS[input.locale](
      input.subscriptionName,
      input.customerName ?? "",
    );
  }
};

// ----------------------------------------------------------------------------
// Subscription plan lookup (AI-powered)
// ----------------------------------------------------------------------------

export interface SubscriptionPlan {
  serviceName: string;
  planName: string;
  monthlyPriceCents: number;
  currency: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  annualPriceCents?: number;
}

const SUBSCRIPTION_LOOKUP_SYSTEM = `You are a subscription pricing expert. The user names a streaming/software/SaaS service.
Return the current plans as a JSON array. Each entry:
{"serviceName":"Netflix","planName":"Standard","monthlyPriceCents":1399,"currency":"EUR","billingCycle":"MONTHLY"}

Rules:
- Use EUR prices for the German market.
- monthlyPriceCents is the monthly cost in cents (e.g. 13.99 EUR → 1399).
- For annual plans, set billingCycle to "ANNUAL" and add "annualPriceCents" with the yearly total in cents.
- Include all currently available plans for the service.
- If you are unsure about a price, make your best estimate and set a round number.
- Return ONLY the JSON array, no prose, no markdown.`;

export const lookupSubscriptionPlans = async (
  serviceName: string,
): Promise<SubscriptionPlan[]> => {
  if (!isAiConfigured()) return [];
  const res = await chat(
    [
      { role: "system", content: SUBSCRIPTION_LOOKUP_SYSTEM },
      { role: "user", content: serviceName },
    ],
    { temperature: 0, cacheSystem: true },
  );
  const cleaned = res.content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as SubscriptionPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// ----------------------------------------------------------------------------
// Finance assistant (free-form)
// ----------------------------------------------------------------------------

export const answerFinanceQuestion = async (input: {
  question: string;
  locale: Locale;
  context: string;
  history: ChatMessage[];
}): Promise<{ answer: string; tokensIn?: number; tokensOut?: number }> => {
  const system = `You are LifeOS, a personal finance assistant. Answer in ${localeName(
    input.locale,
  )}. Be concise and specific. Use only the data provided below — do not invent numbers.

USER DATA:
${input.context}`;
  const res = await chat(
    [
      { role: "system", content: system },
      ...input.history,
      { role: "user", content: input.question },
    ],
    { temperature: 0.3 },
  );
  return {
    answer: res.content,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
  };
};
