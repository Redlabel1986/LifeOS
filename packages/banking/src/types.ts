// ============================================================================
// @lifeos/banking — shared types
// ----------------------------------------------------------------------------
// Provider-agnostic shapes. The DB layer maps these to BankConnection /
// BankAccount / BankTransaction rows.
// ============================================================================

export interface BankInstitution {
  id: string;
  name: string;
  bic: string | null;
  countries: string[];
  logo: string | null;
  transactionTotalDays: number | null;
}

export interface BankAccountInfo {
  externalId: string;
  iban: string | null;
  bic: string | null;
  name: string | null;
  ownerName: string | null;
  currency: string;
  balanceMinor: bigint | null;
  balanceAt: Date | null;
}

export interface BankTransactionRecord {
  externalId: string;
  amountMinor: bigint;
  currency: string;
  bookingDate: Date;
  valueDate: Date | null;
  remittanceInfo: string | null;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  endToEndId: string | null;
  raw: unknown;
}

/**
 * Pluggable banking provider. GoCardless implements live PSD2 access;
 * a CAMT-file pseudo-provider implements offline file imports — both
 * speak the same shapes so the sync pipeline doesn't care.
 */
export interface BankingProvider {
  readonly name: "gocardless" | "camt-file";

  /** List supported institutions for a country (only meaningful for live providers). */
  listInstitutions(countryCode: string): Promise<BankInstitution[]>;

  /**
   * Begin a new connection. For GoCardless this creates a requisition and
   * returns the consent URL. For CAMT this is a no-op.
   */
  beginConnection(input: BeginConnectionInput): Promise<BeginConnectionResult>;

  /** After the user has consented, fetch the linked accounts. */
  fetchAccounts(connectionRef: ConnectionRef): Promise<BankAccountInfo[]>;

  /** Fetch new transactions for an account. `since` is exclusive. */
  fetchTransactions(input: {
    connectionRef: ConnectionRef;
    accountExternalId: string;
    since: Date | null;
  }): Promise<BankTransactionRecord[]>;

  /** Tear down the connection on the provider side. */
  revoke(connectionRef: ConnectionRef): Promise<void>;
}

export interface BeginConnectionInput {
  institutionId: string;
  redirectUrl: string;
  reference: string;
  userLanguage?: string;
  maxHistoricalDays?: number;
}

export interface BeginConnectionResult {
  consentUrl: string;
  requisitionId: string;
  agreementId: string | null;
  expiresAt: Date | null;
}

export interface ConnectionRef {
  requisitionId: string | null;
  institutionId: string | null;
}

export class BankingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BankingError";
  }
}
