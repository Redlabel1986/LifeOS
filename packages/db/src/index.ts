// ============================================================================
// @lifeos/db — public entry
// ----------------------------------------------------------------------------
// Re-exports the shared Prisma client and all generated types + enums.
// This is the only module any other package should import from for DB access.
// ============================================================================

export { prisma, type PrismaClient } from "./client.js";

export {
  Prisma,
  Locale,
  CategoryKind,
  TransactionType,
  TransactionSource,
  BillingCycle,
  SubscriptionStatus,
  DocumentType,
  DocumentStatus,
  ReminderChannel,
  BankConnectionProvider,
  BankConnectionStatus,
  TaxClass,
} from "@prisma/client";

export type {
  User,
  Session,
  Category,
  Merchant,
  UserMerchant,
  Transaction,
  Subscription,
  SubscriptionReminder,
  Document,
  Budget,
  AiConversation,
  AiMessage,
  BankConnection,
  BankAccount,
  BankTransaction,
  TaxProfile,
} from "@prisma/client";
