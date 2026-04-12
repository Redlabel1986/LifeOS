// ============================================================================
// @lifeos/banking — CAMT.053 parser (ISO 20022 bank-to-customer statement)
// ----------------------------------------------------------------------------
// Every German bank lets you download monthly statements in CAMT.053 XML.
// This is the offline fallback for users who don't want live PSD2 access.
//
// The full schema has hundreds of optional fields; we only extract what we
// need to populate `BankAccount` + `BankTransaction`. Tested against:
//   * camt.053.001.02 (most common in DE banks)
//   * camt.053.001.08 (newer SEPA Instant rollout)
// ============================================================================

import { XMLParser } from "fast-xml-parser";
import type {
  BankAccountInfo,
  BankTransactionRecord,
} from "./types.js";
import { BankingError } from "./types.js";

export interface ParsedCamtStatement {
  account: BankAccountInfo;
  transactions: BankTransactionRecord[];
  statementId: string | null;
  fromDate: Date | null;
  toDate: Date | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

const asArray = <T>(v: T | T[] | undefined): T[] => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
};

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return null;
};

const toMinor = (amountStr: string, isCredit: boolean): bigint => {
  const cleaned = amountStr.trim().replace("-", "");
  const [intPart, fracPart = ""] = cleaned.split(".");
  const padded = (fracPart + "00").slice(0, 2);
  const value = BigInt(intPart!) * 100n + BigInt(padded);
  return isCredit ? value : -value;
};

const parseDate = (raw: unknown): Date | null => {
  const s = text(raw);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

interface CamtEntry {
  NtryRef?: string;
  Amt: { "#text": string; "@_Ccy": string };
  CdtDbtInd: string; // CRDT | DBIT
  Sts?: { Cd?: string } | string;
  BookgDt?: { Dt?: string };
  ValDt?: { Dt?: string };
  AcctSvcrRef?: string;
  NtryDtls?: CamtEntryDetails | CamtEntryDetails[];
}

interface CamtEntryDetails {
  TxDtls?: CamtTxDetails | CamtTxDetails[];
}

interface CamtTxDetails {
  Refs?: {
    EndToEndId?: string;
    InstrId?: string;
    AcctSvcrRef?: string;
  };
  Amt?: { "#text": string; "@_Ccy": string };
  RltdPties?: {
    Cdtr?: { Nm?: string };
    CdtrAcct?: { Id?: { IBAN?: string } };
    Dbtr?: { Nm?: string };
    DbtrAcct?: { Id?: { IBAN?: string } };
  };
  RmtInf?: {
    Ustrd?: string | string[];
  };
}

const buildExternalId = (
  entry: CamtEntry,
  txDetails: CamtTxDetails | null,
  index: number,
  bookingDate: Date | null,
): string => {
  return (
    txDetails?.Refs?.AcctSvcrRef ??
    txDetails?.Refs?.EndToEndId ??
    txDetails?.Refs?.InstrId ??
    entry.AcctSvcrRef ??
    entry.NtryRef ??
    `${bookingDate?.toISOString().slice(0, 10) ?? "x"}-${entry.Amt["#text"]}-${entry.CdtDbtInd}-${index}`
  );
};

const flattenRemittance = (txDetails: CamtTxDetails | null): string | null => {
  if (!txDetails?.RmtInf?.Ustrd) return null;
  const arr = asArray(txDetails.RmtInf.Ustrd);
  const joined = arr.map((s) => String(s)).join(" ").trim();
  return joined.length > 0 ? joined : null;
};

const flattenCounterparty = (
  txDetails: CamtTxDetails | null,
  isCredit: boolean,
): { name: string | null; iban: string | null } => {
  if (!txDetails?.RltdPties) return { name: null, iban: null };
  // For an incoming credit, the counterparty is the debtor.
  // For an outgoing debit, the counterparty is the creditor.
  if (isCredit) {
    return {
      name: txDetails.RltdPties.Dbtr?.Nm ?? null,
      iban: txDetails.RltdPties.DbtrAcct?.Id?.IBAN ?? null,
    };
  }
  return {
    name: txDetails.RltdPties.Cdtr?.Nm ?? null,
    iban: txDetails.RltdPties.CdtrAcct?.Id?.IBAN ?? null,
  };
};

export const parseCamt053 = (xml: string): ParsedCamtStatement => {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new BankingError("Invalid XML", "CAMT_PARSE_FAILED", err);
  }

  const root =
    (parsed.Document as Record<string, unknown> | undefined) ??
    (parsed as Record<string, unknown>);
  const bkToCstmrStmt = (root.BkToCstmrStmt ?? root["BkToCstmrStmt"]) as
    | Record<string, unknown>
    | undefined;
  if (!bkToCstmrStmt) {
    throw new BankingError(
      "Not a CAMT.053 document (missing BkToCstmrStmt)",
      "CAMT_NOT_RECOGNIZED",
    );
  }

  const stmt = asArray(bkToCstmrStmt.Stmt)[0] as
    | Record<string, unknown>
    | undefined;
  if (!stmt) {
    throw new BankingError("Empty CAMT.053 (no Stmt)", "CAMT_EMPTY");
  }

  const acctNode = stmt.Acct as
    | { Id?: { IBAN?: string }; Ccy?: string; Nm?: string; Ownr?: { Nm?: string } }
    | undefined;
  const iban = acctNode?.Id?.IBAN ?? null;
  const currency = acctNode?.Ccy ?? "EUR";
  const accountName = acctNode?.Nm ?? null;
  const ownerName = acctNode?.Ownr?.Nm ?? null;

  // Closing balance — used as the account balance snapshot.
  const balances = asArray(stmt.Bal as unknown);
  const closing = balances.find((b) => {
    const cd =
      ((b as { Tp?: { CdOrPrtry?: { Cd?: string } } }).Tp?.CdOrPrtry?.Cd ?? "")
        .toUpperCase();
    return cd === "CLBD";
  }) as
    | {
        Amt?: { "#text": string; "@_Ccy": string };
        Dt?: { Dt?: string };
        CdtDbtInd?: string;
      }
    | undefined;

  const balanceMinor = closing?.Amt
    ? toMinor(closing.Amt["#text"], (closing.CdtDbtInd ?? "CRDT") === "CRDT")
    : null;
  const balanceAt = closing?.Dt ? parseDate(closing.Dt.Dt) : null;

  const fromDate = parseDate(
    (stmt.FrToDt as { FrDtTm?: string } | undefined)?.FrDtTm,
  );
  const toDate = parseDate(
    (stmt.FrToDt as { ToDtTm?: string } | undefined)?.ToDtTm,
  );

  const account: BankAccountInfo = {
    externalId: iban ?? `camt-${(stmt.Id as string | undefined) ?? "unknown"}`,
    iban,
    bic: null,
    name: accountName,
    ownerName,
    currency,
    balanceMinor,
    balanceAt,
  };

  const entries = asArray(stmt.Ntry as unknown) as CamtEntry[];
  const transactions: BankTransactionRecord[] = [];

  entries.forEach((entry, idx) => {
    const isCredit = entry.CdtDbtInd === "CRDT";
    const amountMinor = toMinor(entry.Amt["#text"], isCredit);
    const txCcy = entry.Amt["@_Ccy"] ?? currency;
    const bookingDate = parseDate(entry.BookgDt?.Dt) ?? new Date();
    const valueDate = parseDate(entry.ValDt?.Dt);

    const detailsList = asArray(entry.NtryDtls);
    const txDetailsList: CamtTxDetails[] = detailsList.flatMap((d) =>
      asArray(d.TxDtls),
    );

    if (txDetailsList.length === 0) {
      // Single-leg entry without TxDtls breakdown.
      transactions.push({
        externalId: buildExternalId(entry, null, idx, bookingDate),
        amountMinor,
        currency: txCcy,
        bookingDate,
        valueDate,
        remittanceInfo: null,
        counterpartyName: null,
        counterpartyIban: null,
        endToEndId: null,
        raw: entry,
      });
      return;
    }

    txDetailsList.forEach((txDetails, subIdx) => {
      const txAmount = txDetails.Amt
        ? toMinor(txDetails.Amt["#text"], isCredit)
        : amountMinor;
      const txCurrency = txDetails.Amt?.["@_Ccy"] ?? txCcy;
      const counterparty = flattenCounterparty(txDetails, isCredit);

      transactions.push({
        externalId: buildExternalId(entry, txDetails, idx * 100 + subIdx, bookingDate),
        amountMinor: txAmount,
        currency: txCurrency,
        bookingDate,
        valueDate,
        remittanceInfo: flattenRemittance(txDetails),
        counterpartyName: counterparty.name,
        counterpartyIban: counterparty.iban,
        endToEndId: txDetails.Refs?.EndToEndId ?? null,
        raw: { entry, txDetails },
      });
    });
  });

  return {
    account,
    transactions,
    statementId: (stmt.Id as string | undefined) ?? null,
    fromDate,
    toDate,
  };
};
