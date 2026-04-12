
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  displayName: 'displayName',
  locale: 'locale',
  currency: 'currency',
  timezone: 'timezone',
  emailVerified: 'emailVerified',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  refreshTokenHash: 'refreshTokenHash',
  userAgent: 'userAgent',
  ipAddress: 'ipAddress',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  parentId: 'parentId',
  kind: 'kind',
  slug: 'slug',
  translations: 'translations',
  icon: 'icon',
  color: 'color',
  taxDeductible: 'taxDeductible',
  taxCode: 'taxCode',
  isSystem: 'isSystem',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MerchantScalarFieldEnum = {
  id: 'id',
  name: 'name',
  displayName: 'displayName',
  website: 'website',
  logoUrl: 'logoUrl',
  patterns: 'patterns',
  defaultCategorySlug: 'defaultCategorySlug',
  countryCode: 'countryCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserMerchantScalarFieldEnum = {
  userId: 'userId',
  merchantId: 'merchantId',
  customName: 'customName',
  categoryId: 'categoryId',
  firstSeenAt: 'firstSeenAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TransactionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  categoryId: 'categoryId',
  merchantId: 'merchantId',
  subscriptionId: 'subscriptionId',
  documentId: 'documentId',
  type: 'type',
  source: 'source',
  amountMinor: 'amountMinor',
  currency: 'currency',
  exchangeRate: 'exchangeRate',
  occurredAt: 'occurredAt',
  bookedAt: 'bookedAt',
  description: 'description',
  note: 'note',
  tags: 'tags',
  taxDeductible: 'taxDeductible',
  aiConfidence: 'aiConfidence',
  needsReview: 'needsReview',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  merchantId: 'merchantId',
  categoryId: 'categoryId',
  name: 'name',
  description: 'description',
  status: 'status',
  amountMinor: 'amountMinor',
  currency: 'currency',
  billingCycle: 'billingCycle',
  customCycleDays: 'customCycleDays',
  startedAt: 'startedAt',
  nextRenewalAt: 'nextRenewalAt',
  cancellationDeadline: 'cancellationDeadline',
  cancelledAt: 'cancelledAt',
  cancellationUrl: 'cancellationUrl',
  contactEmail: 'contactEmail',
  contractFileId: 'contractFileId',
  autoDetected: 'autoDetected',
  detectionConfidence: 'detectionConfidence',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionReminderScalarFieldEnum = {
  id: 'id',
  subscriptionId: 'subscriptionId',
  remindAt: 'remindAt',
  sentAt: 'sentAt',
  channel: 'channel',
  createdAt: 'createdAt'
};

exports.Prisma.DocumentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  status: 'status',
  storageKey: 'storageKey',
  storageBucket: 'storageBucket',
  mimeType: 'mimeType',
  sizeBytes: 'sizeBytes',
  originalName: 'originalName',
  checksumSha256: 'checksumSha256',
  language: 'language',
  ocrText: 'ocrText',
  ocrData: 'ocrData',
  extracted: 'extracted',
  summary: 'summary',
  aiTags: 'aiTags',
  uploadedAt: 'uploadedAt',
  processedAt: 'processedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BudgetScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  categoryId: 'categoryId',
  amountMinor: 'amountMinor',
  currency: 'currency',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  rollover: 'rollover',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiConversationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TaxProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  taxClass: 'taxClass',
  churchTax: 'churchTax',
  disabilityDegree: 'disabilityDegree',
  merkzeichenAG: 'merkzeichenAG',
  merkzeichenG: 'merkzeichenG',
  merkzeichenH: 'merkzeichenH',
  merkzeichenBl: 'merkzeichenBl',
  merkzeichenGl: 'merkzeichenGl',
  merkzeichenTBl: 'merkzeichenTBl',
  extraordinaryBurdensMinor: 'extraordinaryBurdensMinor',
  workExpensesMinor: 'workExpensesMinor',
  specialExpensesMinor: 'specialExpensesMinor',
  donationsMinor: 'donationsMinor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AiMessageScalarFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  role: 'role',
  content: 'content',
  toolCalls: 'toolCalls',
  tokensIn: 'tokensIn',
  tokensOut: 'tokensOut',
  model: 'model',
  createdAt: 'createdAt'
};

exports.Prisma.BankConnectionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  provider: 'provider',
  status: 'status',
  institutionId: 'institutionId',
  institutionName: 'institutionName',
  institutionLogo: 'institutionLogo',
  countryCode: 'countryCode',
  requisitionId: 'requisitionId',
  agreementId: 'agreementId',
  consentExpiresAt: 'consentExpiresAt',
  lastSyncedAt: 'lastSyncedAt',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BankAccountScalarFieldEnum = {
  id: 'id',
  connectionId: 'connectionId',
  externalId: 'externalId',
  iban: 'iban',
  bic: 'bic',
  name: 'name',
  ownerName: 'ownerName',
  currency: 'currency',
  balanceMinor: 'balanceMinor',
  balanceAt: 'balanceAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BankTransactionScalarFieldEnum = {
  id: 'id',
  accountId: 'accountId',
  externalId: 'externalId',
  amountMinor: 'amountMinor',
  currency: 'currency',
  bookingDate: 'bookingDate',
  valueDate: 'valueDate',
  remittanceInfo: 'remittanceInfo',
  counterpartyName: 'counterpartyName',
  counterpartyIban: 'counterpartyIban',
  endToEndId: 'endToEndId',
  raw: 'raw',
  lifeosTransactionId: 'lifeosTransactionId',
  importedAt: 'importedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.UserOrderByRelevanceFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  displayName: 'displayName',
  currency: 'currency',
  timezone: 'timezone'
};

exports.Prisma.SessionOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  refreshTokenHash: 'refreshTokenHash',
  userAgent: 'userAgent',
  ipAddress: 'ipAddress'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.CategoryOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  parentId: 'parentId',
  slug: 'slug',
  icon: 'icon',
  color: 'color',
  taxCode: 'taxCode'
};

exports.Prisma.MerchantOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  displayName: 'displayName',
  website: 'website',
  logoUrl: 'logoUrl',
  patterns: 'patterns',
  defaultCategorySlug: 'defaultCategorySlug',
  countryCode: 'countryCode'
};

exports.Prisma.UserMerchantOrderByRelevanceFieldEnum = {
  userId: 'userId',
  merchantId: 'merchantId',
  customName: 'customName',
  categoryId: 'categoryId'
};

exports.Prisma.TransactionOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  categoryId: 'categoryId',
  merchantId: 'merchantId',
  subscriptionId: 'subscriptionId',
  documentId: 'documentId',
  currency: 'currency',
  description: 'description',
  note: 'note',
  tags: 'tags'
};

exports.Prisma.SubscriptionOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  merchantId: 'merchantId',
  categoryId: 'categoryId',
  name: 'name',
  description: 'description',
  currency: 'currency',
  cancellationUrl: 'cancellationUrl',
  contactEmail: 'contactEmail',
  contractFileId: 'contractFileId'
};

exports.Prisma.SubscriptionReminderOrderByRelevanceFieldEnum = {
  id: 'id',
  subscriptionId: 'subscriptionId'
};

exports.Prisma.DocumentOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  storageKey: 'storageKey',
  storageBucket: 'storageBucket',
  mimeType: 'mimeType',
  originalName: 'originalName',
  checksumSha256: 'checksumSha256',
  language: 'language',
  ocrText: 'ocrText',
  summary: 'summary',
  aiTags: 'aiTags'
};

exports.Prisma.BudgetOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  categoryId: 'categoryId',
  currency: 'currency'
};

exports.Prisma.AiConversationOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title'
};

exports.Prisma.TaxProfileOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId'
};

exports.Prisma.AiMessageOrderByRelevanceFieldEnum = {
  id: 'id',
  conversationId: 'conversationId',
  role: 'role',
  content: 'content',
  model: 'model'
};

exports.Prisma.BankConnectionOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  institutionId: 'institutionId',
  institutionName: 'institutionName',
  institutionLogo: 'institutionLogo',
  countryCode: 'countryCode',
  requisitionId: 'requisitionId',
  agreementId: 'agreementId',
  errorMessage: 'errorMessage'
};

exports.Prisma.BankAccountOrderByRelevanceFieldEnum = {
  id: 'id',
  connectionId: 'connectionId',
  externalId: 'externalId',
  iban: 'iban',
  bic: 'bic',
  name: 'name',
  ownerName: 'ownerName',
  currency: 'currency'
};

exports.Prisma.BankTransactionOrderByRelevanceFieldEnum = {
  id: 'id',
  accountId: 'accountId',
  externalId: 'externalId',
  currency: 'currency',
  remittanceInfo: 'remittanceInfo',
  counterpartyName: 'counterpartyName',
  counterpartyIban: 'counterpartyIban',
  endToEndId: 'endToEndId',
  lifeosTransactionId: 'lifeosTransactionId'
};
exports.Locale = exports.$Enums.Locale = {
  de: 'de',
  en: 'en',
  fr: 'fr',
  ar: 'ar'
};

exports.CategoryKind = exports.$Enums.CategoryKind = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
};

exports.TransactionType = exports.$Enums.TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER'
};

exports.TransactionSource = exports.$Enums.TransactionSource = {
  MANUAL: 'MANUAL',
  DOCUMENT: 'DOCUMENT',
  EMAIL: 'EMAIL',
  BANK_IMPORT: 'BANK_IMPORT',
  AI_SUGGESTED: 'AI_SUGGESTED'
};

exports.SubscriptionStatus = exports.$Enums.SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

exports.BillingCycle = exports.$Enums.BillingCycle = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMI_ANNUAL: 'SEMI_ANNUAL',
  ANNUAL: 'ANNUAL',
  CUSTOM: 'CUSTOM'
};

exports.ReminderChannel = exports.$Enums.ReminderChannel = {
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  IN_APP: 'IN_APP'
};

exports.DocumentType = exports.$Enums.DocumentType = {
  RECEIPT: 'RECEIPT',
  INVOICE: 'INVOICE',
  CONTRACT: 'CONTRACT',
  LETTER: 'LETTER',
  TAX_DOCUMENT: 'TAX_DOCUMENT',
  PAYSLIP: 'PAYSLIP',
  OTHER: 'OTHER'
};

exports.DocumentStatus = exports.$Enums.DocumentStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED'
};

exports.TaxClass = exports.$Enums.TaxClass = {
  CLASS_1: 'CLASS_1',
  CLASS_2: 'CLASS_2',
  CLASS_3: 'CLASS_3',
  CLASS_4: 'CLASS_4',
  CLASS_5: 'CLASS_5',
  CLASS_6: 'CLASS_6'
};

exports.BankConnectionProvider = exports.$Enums.BankConnectionProvider = {
  GOCARDLESS: 'GOCARDLESS',
  CAMT_FILE: 'CAMT_FILE'
};

exports.BankConnectionStatus = exports.$Enums.BankConnectionStatus = {
  PENDING_CONSENT: 'PENDING_CONSENT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  ERROR: 'ERROR'
};

exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  Category: 'Category',
  Merchant: 'Merchant',
  UserMerchant: 'UserMerchant',
  Transaction: 'Transaction',
  Subscription: 'Subscription',
  SubscriptionReminder: 'SubscriptionReminder',
  Document: 'Document',
  Budget: 'Budget',
  AiConversation: 'AiConversation',
  TaxProfile: 'TaxProfile',
  AiMessage: 'AiMessage',
  BankConnection: 'BankConnection',
  BankAccount: 'BankAccount',
  BankTransaction: 'BankTransaction'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
