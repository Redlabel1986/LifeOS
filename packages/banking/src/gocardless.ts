// ============================================================================
// @lifeos/banking — GoCardless Bank Account Data adapter
// ----------------------------------------------------------------------------
// PSD2-compliant bank access via GoCardless (formerly Nordigen).
// Free tier covers personal/MVP use, supports 2300+ banks across 31 countries
// including all major German banks.
//
// Docs: https://bankaccountdata.gocardless.com/api/docs
//
// Auth flow (per request):
//   1. POST /token/new      → access_token (24h) + refresh_token (30d)
//   2. POST /token/refresh/ → access_token (24h)
//
// Connection flow:
//   1. POST /agreements/enduser/  → end_user_agreement
//   2. POST /requisitions/        → consent link (user visits this)
//   3. user grants consent at their bank → redirected to our callback
//   4. GET  /requisitions/{id}/   → list of linked account UUIDs
//   5. GET  /accounts/{id}/transactions/  → booked + pending transactions
// ============================================================================

import type {
  BankAccountInfo,
  BankInstitution,
  BankTransactionRecord,
  BankingProvider,
  BeginConnectionInput,
  BeginConnectionResult,
  ConnectionRef,
} from "./types.js";
import { BankingError } from "./types.js";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

interface TokenState {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
}

interface RawTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban?: string };
  debtorAccount?: { iban?: string };
  endToEndId?: string;
}

export class GoCardlessProvider implements BankingProvider {
  readonly name = "gocardless" as const;

  private token: TokenState | null = null;

  constructor(
    private readonly secretId: string,
    private readonly secretKey: string,
  ) {
    if (!secretId || !secretKey) {
      throw new BankingError(
        "GoCardless secretId and secretKey are required",
        "MISSING_CREDENTIALS",
      );
    }
  }

  // --- Auth ----------------------------------------------------------------

  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.token.accessExpiresAt - 60_000) {
      return this.token.accessToken;
    }
    const res = await fetch(`${BASE_URL}/token/new/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ secret_id: this.secretId, secret_key: this.secretKey }),
    });
    if (!res.ok) {
      throw new BankingError(
        `GoCardless authentication failed (${res.status})`,
        "AUTH_FAILED",
        await safeBody(res),
      );
    }
    const json = (await res.json()) as {
      access: string;
      access_expires: number;
      refresh: string;
    };
    this.token = {
      accessToken: json.access,
      accessExpiresAt: Date.now() + json.access_expires * 1000,
      refreshToken: json.refresh,
    };
    return this.token.accessToken;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await this.authenticate();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new BankingError(
        `GoCardless request failed: ${init.method ?? "GET"} ${path} (${res.status})`,
        "REQUEST_FAILED",
        await safeBody(res),
      );
    }
    return (await res.json()) as T;
  }

  // --- Public API ----------------------------------------------------------

  async listInstitutions(countryCode: string): Promise<BankInstitution[]> {
    const data = await this.request<
      Array<{
        id: string;
        name: string;
        bic: string | null;
        countries: string[];
        logo: string | null;
        transaction_total_days: string | null;
      }>
    >(`/institutions/?country=${encodeURIComponent(countryCode)}`);
    return data.map((i) => ({
      id: i.id,
      name: i.name,
      bic: i.bic ?? null,
      countries: i.countries,
      logo: i.logo,
      transactionTotalDays: i.transaction_total_days
        ? Number.parseInt(i.transaction_total_days, 10)
        : null,
    }));
  }

  async beginConnection(
    input: BeginConnectionInput,
  ): Promise<BeginConnectionResult> {
    const maxDays = input.maxHistoricalDays ?? 90;
    const agreement = await this.request<{
      id: string;
      access_valid_for_days: number;
      max_historical_days: number;
    }>("/agreements/enduser/", {
      method: "POST",
      body: JSON.stringify({
        institution_id: input.institutionId,
        max_historical_days: maxDays,
        access_valid_for_days: 90,
        access_scope: ["balances", "details", "transactions"],
      }),
    });

    const requisition = await this.request<{
      id: string;
      link: string;
      created: string;
    }>("/requisitions/", {
      method: "POST",
      body: JSON.stringify({
        institution_id: input.institutionId,
        agreement: agreement.id,
        redirect: input.redirectUrl,
        reference: input.reference,
        user_language: input.userLanguage ?? "DE",
      }),
    });

    return {
      consentUrl: requisition.link,
      requisitionId: requisition.id,
      agreementId: agreement.id,
      expiresAt: new Date(Date.now() + 90 * 86_400_000),
    };
  }

  async fetchAccounts(connectionRef: ConnectionRef): Promise<BankAccountInfo[]> {
    if (!connectionRef.requisitionId) {
      throw new BankingError(
        "Missing requisition id on connectionRef",
        "MISSING_REQUISITION",
      );
    }
    const requisition = await this.request<{ accounts: string[] }>(
      `/requisitions/${connectionRef.requisitionId}/`,
    );

    const out: BankAccountInfo[] = [];
    for (const accountId of requisition.accounts) {
      const [details, balances] = await Promise.all([
        this.request<{
          account: {
            iban?: string;
            bic?: string;
            currency?: string;
            ownerName?: string;
            name?: string;
            displayName?: string;
            product?: string;
          };
        }>(`/accounts/${accountId}/details/`).catch(() => null),
        this.request<{
          balances: Array<{
            balanceAmount: { amount: string; currency: string };
            balanceType: string;
            referenceDate?: string;
          }>;
        }>(`/accounts/${accountId}/balances/`).catch(() => null),
      ]);

      const account = details?.account;
      const closing =
        balances?.balances.find((b) => b.balanceType === "closingBooked") ??
        balances?.balances[0];

      out.push({
        externalId: accountId,
        iban: account?.iban ?? null,
        bic: account?.bic ?? null,
        name: account?.displayName ?? account?.name ?? account?.product ?? null,
        ownerName: account?.ownerName ?? null,
        currency: account?.currency ?? closing?.balanceAmount.currency ?? "EUR",
        balanceMinor: closing
          ? toMinor(closing.balanceAmount.amount)
          : null,
        balanceAt: closing?.referenceDate ? new Date(closing.referenceDate) : null,
      });
    }
    return out;
  }

  async fetchTransactions(input: {
    connectionRef: ConnectionRef;
    accountExternalId: string;
    since: Date | null;
  }): Promise<BankTransactionRecord[]> {
    const fromQuery = input.since
      ? `?date_from=${input.since.toISOString().slice(0, 10)}`
      : "";
    const data = await this.request<{
      transactions: { booked: RawTransaction[]; pending: RawTransaction[] };
    }>(`/accounts/${input.accountExternalId}/transactions/${fromQuery}`);

    return data.transactions.booked.map((tx) => mapRawTransaction(tx));
  }

  async revoke(connectionRef: ConnectionRef): Promise<void> {
    if (!connectionRef.requisitionId) return;
    try {
      await this.request(`/requisitions/${connectionRef.requisitionId}/`, {
        method: "DELETE",
      });
    } catch (err) {
      // Already revoked or expired — log and continue.
      if (err instanceof BankingError && err.code === "REQUEST_FAILED") return;
      throw err;
    }
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const toMinor = (raw: string): bigint => {
  // GoCardless returns "12.34" or "-12.34"; convert to integer cents.
  const negative = raw.startsWith("-");
  const cleaned = raw.replace("-", "");
  const [intPart, fracPart = ""] = cleaned.split(".");
  const padded = (fracPart + "00").slice(0, 2);
  const result = BigInt(intPart!) * 100n + BigInt(padded);
  return negative ? -result : result;
};

const mapRawTransaction = (tx: RawTransaction): BankTransactionRecord => {
  const id =
    tx.transactionId ??
    tx.internalTransactionId ??
    `${tx.bookingDate ?? ""}-${tx.transactionAmount?.amount ?? ""}-${tx.endToEndId ?? Math.random()}`;

  const remittance =
    tx.remittanceInformationUnstructured ??
    tx.remittanceInformationUnstructuredArray?.join(" ") ??
    null;

  const counterpartyName = tx.creditorName ?? tx.debtorName ?? null;
  const counterpartyIban =
    tx.creditorAccount?.iban ?? tx.debtorAccount?.iban ?? null;

  return {
    externalId: id,
    amountMinor: toMinor(tx.transactionAmount?.amount ?? "0"),
    currency: tx.transactionAmount?.currency ?? "EUR",
    bookingDate: tx.bookingDate ? new Date(tx.bookingDate) : new Date(),
    valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
    remittanceInfo: remittance,
    counterpartyName,
    counterpartyIban,
    endToEndId: tx.endToEndId ?? null,
    raw: tx,
  };
};

const safeBody = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    return await res.text().catch(() => null);
  }
};
