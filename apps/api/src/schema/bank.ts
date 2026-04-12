// ============================================================================
// apps/api — Banking GraphQL types and resolvers
// ----------------------------------------------------------------------------
// Exposes:
//   * BankConnection / BankAccount / BankTransaction object types
//   * Query.bankInstitutions(country)
//   * Query.bankConnections
//   * Mutation.connectBank → returns consent URL
//   * Mutation.confirmBankConnection → fetches accounts after consent callback
//   * Mutation.syncBankAccount → manual pull
//   * Mutation.disconnectBank
//   * Mutation.importCamtFile → CAMT.053 base64 upload
// ============================================================================

import {
  getGoCardlessProvider,
  isGoCardlessConfigured,
} from "@lifeos/banking";
import {
  BankConnectionProvider,
  BankConnectionStatus,
} from "@lifeos/db";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import {
  importCamtFile,
  syncGoCardlessAccount,
} from "../services/bank-sync.js";
import { getQueue } from "../queue.js";
import { MoneyRef } from "./shared.js";

builder.enumType(BankConnectionProvider, { name: "BankConnectionProvider" });
builder.enumType(BankConnectionStatus, { name: "BankConnectionStatus" });

// --- BankConnection ---------------------------------------------------------

builder.prismaObject("BankConnection", {
  fields: (t) => ({
    id: t.exposeID("id"),
    provider: t.field({
      type: BankConnectionProvider,
      resolve: (c) => c.provider,
    }),
    status: t.field({
      type: BankConnectionStatus,
      resolve: (c) => c.status,
    }),
    institutionName: t.exposeString("institutionName"),
    institutionLogo: t.exposeString("institutionLogo", { nullable: true }),
    countryCode: t.exposeString("countryCode", { nullable: true }),
    consentExpiresAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (c) => c.consentExpiresAt?.toISOString() ?? null,
    }),
    lastSyncedAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (c) => c.lastSyncedAt?.toISOString() ?? null,
    }),
    errorMessage: t.exposeString("errorMessage", { nullable: true }),
    accounts: t.relation("accounts"),
    createdAt: t.field({
      type: "DateTime",
      resolve: (c) => c.createdAt.toISOString(),
    }),
  }),
});

// --- BankAccount ------------------------------------------------------------

builder.prismaObject("BankAccount", {
  fields: (t) => ({
    id: t.exposeID("id"),
    iban: t.exposeString("iban", { nullable: true }),
    bic: t.exposeString("bic", { nullable: true }),
    name: t.exposeString("name", { nullable: true }),
    ownerName: t.exposeString("ownerName", { nullable: true }),
    currency: t.exposeString("currency"),
    balance: t.field({
      type: MoneyRef,
      nullable: true,
      resolve: (a) =>
        a.balanceMinor !== null
          ? { amountMinor: a.balanceMinor, currency: a.currency }
          : null,
    }),
    balanceAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (a) => a.balanceAt?.toISOString() ?? null,
    }),
    transactionCount: t.int({
      resolve: (a, _args, ctx) =>
        ctx.prisma.bankTransaction.count({ where: { accountId: a.id } }),
    }),
    connection: t.relation("connection"),
  }),
});

// --- BankInstitution (provider lookup, not stored) --------------------------

interface InstitutionShape {
  id: string;
  name: string;
  bic: string | null;
  countries: string[];
  logo: string | null;
  transactionTotalDays: number | null;
}

const BankInstitutionRef = builder
  .objectRef<InstitutionShape>("BankInstitution")
  .implement({
    fields: (t) => ({
      id: t.exposeString("id"),
      name: t.exposeString("name"),
      bic: t.exposeString("bic", { nullable: true }),
      countries: t.exposeStringList("countries"),
      logo: t.exposeString("logo", { nullable: true }),
      transactionTotalDays: t.exposeInt("transactionTotalDays", {
        nullable: true,
      }),
    }),
  });

// --- Result shapes ----------------------------------------------------------

interface ConnectBankResultShape {
  consentUrl: string;
  connectionId: string;
}
const ConnectBankResultRef = builder
  .objectRef<ConnectBankResultShape>("ConnectBankResult")
  .implement({
    fields: (t) => ({
      consentUrl: t.exposeString("consentUrl"),
      connectionId: t.exposeID("connectionId"),
    }),
  });

interface SyncResultShape {
  newTransactions: number;
  totalScanned: number;
  errors: string[];
}
const BankSyncResultRef = builder
  .objectRef<SyncResultShape>("BankSyncResult")
  .implement({
    fields: (t) => ({
      newTransactions: t.exposeInt("newTransactions"),
      totalScanned: t.exposeInt("totalScanned"),
      errors: t.exposeStringList("errors"),
    }),
  });

interface RecategorizeResultShape {
  analyzed: number;
  updated: number;
}
const RecategorizeResultRef = builder
  .objectRef<RecategorizeResultShape>("RecategorizeResult")
  .implement({
    fields: (t) => ({
      analyzed: t.exposeInt("analyzed"),
      updated: t.exposeInt("updated"),
    }),
  });

interface CamtImportResultShape {
  connectionId: string;
  accountId: string;
  newTransactions: number;
  totalScanned: number;
  errors: string[];
}
const CamtImportResultRef = builder
  .objectRef<CamtImportResultShape>("CamtImportResult")
  .implement({
    fields: (t) => ({
      connectionId: t.exposeID("connectionId"),
      accountId: t.exposeID("accountId"),
      newTransactions: t.exposeInt("newTransactions"),
      totalScanned: t.exposeInt("totalScanned"),
      errors: t.exposeStringList("errors"),
    }),
  });

// --- Queries ----------------------------------------------------------------

builder.queryField("bankingConfigured", (t) =>
  t.boolean({
    resolve: () => isGoCardlessConfigured(),
  }),
);

builder.queryField("bankInstitutions", (t) =>
  t.field({
    type: [BankInstitutionRef],
    args: {
      country: t.arg.string({ required: false, defaultValue: "DE" }),
    },
    resolve: async (_parent, { country }, ctx) => {
      requireUser(ctx);
      if (!isGoCardlessConfigured()) {
        throw new GraphQLError(
          "GoCardless is not configured on this server",
          { extensions: { code: "BANKING_NOT_CONFIGURED" } },
        );
      }
      const provider = getGoCardlessProvider();
      return provider.listInstitutions(country ?? "DE");
    },
  }),
);

builder.queryField("bankConnections", (t) =>
  t.prismaField({
    type: ["BankConnection"],
    resolve: (query, _parent, _args, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.bankConnection.findMany({
        ...query,
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
    },
  }),
);

// --- Mutations --------------------------------------------------------------

const ConnectBankInput = builder.inputType("ConnectBankInput", {
  fields: (t) => ({
    institutionId: t.string({ required: true }),
    institutionName: t.string({ required: true }),
    institutionLogo: t.string({ required: false }),
    redirectUrl: t.string({ required: true }),
  }),
});

builder.mutationField("connectBank", (t) =>
  t.field({
    type: ConnectBankResultRef,
    args: { input: t.arg({ type: ConnectBankInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      if (!isGoCardlessConfigured()) {
        throw new GraphQLError("Banking provider not configured", {
          extensions: { code: "BANKING_NOT_CONFIGURED" },
        });
      }
      const provider = getGoCardlessProvider();
      const connection = await ctx.prisma.bankConnection.create({
        data: {
          userId: user.id,
          provider: BankConnectionProvider.GOCARDLESS,
          status: BankConnectionStatus.PENDING_CONSENT,
          institutionId: input.institutionId,
          institutionName: input.institutionName,
          institutionLogo: input.institutionLogo ?? null,
          countryCode: "DE",
        },
      });
      const begin = await provider.beginConnection({
        institutionId: input.institutionId,
        redirectUrl: input.redirectUrl,
        reference: connection.id,
        userLanguage: user.locale.toUpperCase(),
        maxHistoricalDays: 90,
      });
      await ctx.prisma.bankConnection.update({
        where: { id: connection.id },
        data: {
          requisitionId: begin.requisitionId,
          agreementId: begin.agreementId,
          consentExpiresAt: begin.expiresAt,
        },
      });
      return { consentUrl: begin.consentUrl, connectionId: connection.id };
    },
  }),
);

builder.mutationField("confirmBankConnection", (t) =>
  t.prismaField({
    type: "BankConnection",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: { id, userId: user.id },
      });
      if (!connection) {
        throw new GraphQLError("Connection not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (connection.provider !== BankConnectionProvider.GOCARDLESS) {
        throw new GraphQLError("Only GoCardless connections can be confirmed", {
          extensions: { code: "WRONG_PROVIDER" },
        });
      }

      const provider = getGoCardlessProvider();
      const accounts = await provider.fetchAccounts({
        requisitionId: connection.requisitionId,
        institutionId: connection.institutionId,
      });

      for (const acc of accounts) {
        await ctx.prisma.bankAccount.upsert({
          where: {
            connectionId_externalId: {
              connectionId: connection.id,
              externalId: acc.externalId,
            },
          },
          create: {
            connectionId: connection.id,
            externalId: acc.externalId,
            iban: acc.iban,
            bic: acc.bic,
            name: acc.name,
            ownerName: acc.ownerName,
            currency: acc.currency,
            balanceMinor: acc.balanceMinor,
            balanceAt: acc.balanceAt,
          },
          update: {
            iban: acc.iban,
            bic: acc.bic,
            name: acc.name,
            ownerName: acc.ownerName,
            currency: acc.currency,
            balanceMinor: acc.balanceMinor,
            balanceAt: acc.balanceAt,
          },
        });
      }

      return ctx.prisma.bankConnection.update({
        ...query,
        where: { id: connection.id },
        data: {
          status: BankConnectionStatus.ACTIVE,
          errorMessage: null,
        },
      });
    },
  }),
);

builder.mutationField("syncBankAccount", (t) =>
  t.field({
    type: BankSyncResultRef,
    args: { accountId: t.arg.id({ required: true }) },
    resolve: async (_parent, { accountId }, ctx) => {
      const user = requireUser(ctx);
      const account = await ctx.prisma.bankAccount.findFirst({
        where: { id: accountId, connection: { userId: user.id } },
      });
      if (!account) {
        throw new GraphQLError("Account not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return syncGoCardlessAccount(account.id);
    },
  }),
);

builder.mutationField("syncBankConnection", (t) =>
  t.field({
    type: BankSyncResultRef,
    args: { connectionId: t.arg.id({ required: true }) },
    resolve: async (_parent, { connectionId }, ctx) => {
      const user = requireUser(ctx);
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: { id: connectionId, userId: user.id },
        include: { accounts: true },
      });
      if (!connection) {
        throw new GraphQLError("Connection not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (connection.provider !== BankConnectionProvider.GOCARDLESS) {
        throw new GraphQLError("CAMT connections cannot be synced live", {
          extensions: { code: "WRONG_PROVIDER" },
        });
      }
      const totals: SyncResultShape = {
        newTransactions: 0,
        totalScanned: 0,
        errors: [],
      };
      for (const acc of connection.accounts) {
        const r = await syncGoCardlessAccount(acc.id);
        totals.newTransactions += r.newTransactions;
        totals.totalScanned += r.totalScanned;
        totals.errors.push(...r.errors);
      }
      return totals;
    },
  }),
);

builder.mutationField("disconnectBank", (t) =>
  t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const connection = await ctx.prisma.bankConnection.findFirst({
        where: { id, userId: user.id },
      });
      if (!connection) {
        throw new GraphQLError("Connection not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (
        connection.provider === BankConnectionProvider.GOCARDLESS &&
        connection.requisitionId
      ) {
        try {
          const provider = getGoCardlessProvider();
          await provider.revoke({
            requisitionId: connection.requisitionId,
            institutionId: connection.institutionId,
          });
        } catch {
          // Ignore — the local row will be deleted regardless.
        }
      }
      await ctx.prisma.bankConnection.delete({ where: { id } });
      return true;
    },
  }),
);

builder.mutationField("analyzeBankAccount", (t) =>
  t.field({
    type: RecategorizeResultRef,
    args: {
      accountId: t.arg.id({ required: false }),
      force: t.arg.boolean({ required: false, defaultValue: false }),
    },
    resolve: async (_parent, { accountId, force }, ctx) => {
      const user = requireUser(ctx);
      if (accountId) {
        const owned = await ctx.prisma.bankAccount.findFirst({
          where: { id: accountId, connection: { userId: user.id } },
        });
        if (!owned) {
          throw new GraphQLError("Account not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
      }
      // Dispatch to background worker — return immediately so the UI
      // doesn't hang waiting for potentially hundreds of AI calls.
      const queue = await getQueue();
      await queue.enqueueRecategorizeBank({
        userId: user.id,
        accountId: accountId ?? undefined,
        force: force ?? false,
      });
      // Return zeros to signal "queued" — the work happens in background.
      return { analyzed: 0, updated: 0 };
    },
  }),
);

const ImportCamtInput = builder.inputType("ImportCamtInput", {
  fields: (t) => ({
    fileBase64: t.string({ required: true }),
    institutionName: t.string({ required: false }),
  }),
});

builder.mutationField("importCamtFile", (t) =>
  t.field({
    type: CamtImportResultRef,
    args: { input: t.arg({ type: ImportCamtInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      let xml: string;
      try {
        xml = Buffer.from(input.fileBase64, "base64").toString("utf8");
      } catch {
        throw new GraphQLError("Invalid base64 payload", {
          extensions: { code: "INVALID_INPUT" },
        });
      }
      try {
        const result = await importCamtFile({
          userId: user.id,
          xml,
          institutionName: input.institutionName ?? undefined,
        });
        return {
          connectionId: result.connectionId,
          accountId: result.accountId,
          newTransactions: result.result.newTransactions,
          totalScanned: result.result.totalScanned,
          errors: result.result.errors,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new GraphQLError(`CAMT import failed: ${message}`, {
          extensions: { code: "CAMT_IMPORT_FAILED" },
        });
      }
    },
  }),
);
