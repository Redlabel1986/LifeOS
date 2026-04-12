// ============================================================================
// @lifeos/banking — entry
// ----------------------------------------------------------------------------
// Factory that returns the configured GoCardless provider, plus the CAMT
// parser and shared types. The provider is constructed lazily so the package
// can be imported (e.g. for the CAMT parser alone) without GoCardless creds.
// ============================================================================

import { env } from "@lifeos/config";
import { GoCardlessProvider } from "./gocardless.js";
import type { BankingProvider } from "./types.js";

let cached: GoCardlessProvider | null = null;

export const getGoCardlessProvider = (): GoCardlessProvider => {
  if (cached) return cached;
  if (!env.GOCARDLESS_SECRET_ID || !env.GOCARDLESS_SECRET_KEY) {
    throw new Error(
      "GoCardless is not configured: set GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in .env",
    );
  }
  cached = new GoCardlessProvider(
    env.GOCARDLESS_SECRET_ID,
    env.GOCARDLESS_SECRET_KEY,
  );
  return cached;
};

export const isGoCardlessConfigured = (): boolean =>
  Boolean(env.GOCARDLESS_SECRET_ID && env.GOCARDLESS_SECRET_KEY);

export type {
  BankAccountInfo,
  BankInstitution,
  BankTransactionRecord,
  BankingProvider,
  BeginConnectionInput,
  BeginConnectionResult,
  ConnectionRef,
} from "./types.js";

export { BankingError } from "./types.js";
export { GoCardlessProvider } from "./gocardless.js";
export { parseCamt053, type ParsedCamtStatement } from "./camt.js";
