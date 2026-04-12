// ============================================================================
// @lifeos/utils — pure helpers
// ----------------------------------------------------------------------------
// Money math in minor units, locale-aware formatters, date helpers.
// No side effects. No framework dependencies.
// ============================================================================

export type SupportedLocale = "de" | "en" | "fr" | "ar";

export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set(["ar"]);

export const isRtl = (locale: SupportedLocale): boolean => RTL_LOCALES.has(locale);

export const directionFor = (locale: SupportedLocale): "ltr" | "rtl" =>
  isRtl(locale) ? "rtl" : "ltr";

// --- Money ------------------------------------------------------------------

export interface Money {
  amountMinor: bigint;
  currency: string;
}

const MINOR_UNITS_PER_CURRENCY: Record<string, number> = {
  EUR: 100,
  USD: 100,
  GBP: 100,
  CHF: 100,
  JPY: 1,
};

export const minorUnitsFor = (currency: string): number =>
  MINOR_UNITS_PER_CURRENCY[currency.toUpperCase()] ?? 100;

export const toMajorNumber = (m: Money): number => {
  const factor = minorUnitsFor(m.currency);
  return Number(m.amountMinor) / factor;
};

export const fromMajor = (major: number, currency: string): Money => {
  const factor = minorUnitsFor(currency);
  return { amountMinor: BigInt(Math.round(major * factor)), currency };
};

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} and ${b.currency}`);
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
};

export const subMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract ${a.currency} and ${b.currency}`);
  }
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
};

export const zeroMoney = (currency: string): Money => ({
  amountMinor: 0n,
  currency,
});

export const formatMoney = (m: Money, locale: SupportedLocale): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
  }).format(toMajorNumber(m));

// --- Date -------------------------------------------------------------------

export const formatDate = (date: Date, locale: SupportedLocale): string =>
  new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);

export const formatDateTime = (date: Date, locale: SupportedLocale): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

export const startOfMonth = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export const endOfMonth = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

export const startOfYear = (year: number): Date =>
  new Date(Date.UTC(year, 0, 1));

export const endOfYear = (year: number): Date =>
  new Date(Date.UTC(year + 1, 0, 1));

export const addDays = (d: Date, days: number): Date =>
  new Date(d.getTime() + days * 86_400_000);

export const daysBetween = (a: Date, b: Date): number =>
  Math.floor((b.getTime() - a.getTime()) / 86_400_000);

// --- Billing cycles ---------------------------------------------------------

export type BillingCycle =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMI_ANNUAL"
  | "ANNUAL"
  | "CUSTOM";

export const advanceByCycle = (
  from: Date,
  cycle: BillingCycle,
  customDays?: number | null,
): Date => {
  const d = new Date(from.getTime());
  switch (cycle) {
    case "WEEKLY":
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case "MONTHLY":
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
    case "QUARTERLY":
      d.setUTCMonth(d.getUTCMonth() + 3);
      return d;
    case "SEMI_ANNUAL":
      d.setUTCMonth(d.getUTCMonth() + 6);
      return d;
    case "ANNUAL":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    case "CUSTOM":
      return addDays(d, customDays ?? 30);
  }
};

// --- Strings ----------------------------------------------------------------

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

// --- Germany tax -----------------------------------------------------------

export {
  estimateRefund,
  incomeTaxGrundtarif2024,
  incomeTaxSplittingtarif2024,
  disabilityPauschbetrag,
  mobilityPauschbetrag,
  WERBUNGSKOSTEN_PAUSCHBETRAG_EUR,
  SONDERAUSGABEN_PAUSCHBETRAG_EUR,
  GRUNDFREIBETRAG_2024_EUR,
  type TaxClass as DeTaxClass,
  type DisabilityInput,
  type RefundInput,
  type RefundResult,
} from "./de-tax.js";
