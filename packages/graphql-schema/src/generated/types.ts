export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: string; output: string; }
  DateTime: { input: string; output: string; }
  Decimal: { input: string; output: string; }
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AiConversation = {
  __typename?: 'AiConversation';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  messages: Array<AiMessage>;
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type AiMessage = {
  __typename?: 'AiMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  role: Scalars['String']['output'];
};

export type AiMessagePayload = {
  __typename?: 'AiMessagePayload';
  conversation: AiConversation;
  message: AiMessage;
};

export type Anomaly = {
  __typename?: 'Anomaly';
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  message: Scalars['String']['output'];
  relatedSubscription: Maybe<Subscription>;
  relatedTransaction: Maybe<Transaction>;
  severity: Scalars['String']['output'];
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  refreshToken: Scalars['String']['output'];
  user: User;
};

export enum BillingCycle {
  Annual = 'ANNUAL',
  Custom = 'CUSTOM',
  Monthly = 'MONTHLY',
  Quarterly = 'QUARTERLY',
  SemiAnnual = 'SEMI_ANNUAL',
  Weekly = 'WEEKLY'
}

export type Budget = {
  __typename?: 'Budget';
  category: Maybe<Category>;
  id: Scalars['ID']['output'];
  money: Money;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  progress: Scalars['Float']['output'];
  remaining: Money;
  rollover: Scalars['Boolean']['output'];
  spent: Money;
};

export type BudgetPayload = {
  __typename?: 'BudgetPayload';
  budget: Budget;
};

/**
 * Localized cancellation email draft. The client shows this to the user,
 * who confirms via `sendCancellationEmail` — nothing leaves the server before
 * that explicit confirmation.
 */
export type CancellationDraft = {
  __typename?: 'CancellationDraft';
  body: Scalars['String']['output'];
  locale: Locale;
  recipient: Maybe<Scalars['String']['output']>;
  subject: Scalars['String']['output'];
};

export type Category = {
  __typename?: 'Category';
  children: Array<Category>;
  color: Maybe<Scalars['String']['output']>;
  icon: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isSystem: Scalars['Boolean']['output'];
  kind: CategoryKind;
  /** Localized name. Defaults to viewer's locale when `locale` is omitted. */
  name: Scalars['String']['output'];
  parent: Maybe<Category>;
  slug: Scalars['String']['output'];
  taxCode: Maybe<Scalars['String']['output']>;
  taxDeductible: Scalars['Boolean']['output'];
  /** Raw translations map: { de, en, fr, ar } */
  translations: Scalars['JSON']['output'];
};


export type CategoryNameArgs = {
  locale?: InputMaybe<Locale>;
};

export type CategoryBreakdownItem = {
  __typename?: 'CategoryBreakdownItem';
  category: Maybe<Category>;
  share: Scalars['Float']['output'];
  total: Money;
  transactionCount: Scalars['Int']['output'];
};

export enum CategoryKind {
  Expense = 'EXPENSE',
  Income = 'INCOME'
}

export type CategoryPayload = {
  __typename?: 'CategoryPayload';
  category: Category;
};

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type ConfirmDocumentUploadInput = {
  documentId: Scalars['ID']['input'];
};

export type CreateCategoryInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  kind: CategoryKind;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  slug: Scalars['String']['input'];
  taxCode?: InputMaybe<Scalars['String']['input']>;
  taxDeductible?: InputMaybe<Scalars['Boolean']['input']>;
  translations: Scalars['JSON']['input'];
};

export type CreateSubscriptionInput = {
  billingCycle: BillingCycle;
  cancellationDeadline?: InputMaybe<Scalars['DateTime']['input']>;
  cancellationUrl?: InputMaybe<Scalars['String']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  contactEmail?: InputMaybe<Scalars['String']['input']>;
  customCycleDays?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  merchantId?: InputMaybe<Scalars['ID']['input']>;
  money: MoneyInput;
  name: Scalars['String']['input'];
  nextRenewalAt?: InputMaybe<Scalars['DateTime']['input']>;
  startedAt: Scalars['DateTime']['input'];
};

export type CreateTransactionInput = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  documentId?: InputMaybe<Scalars['ID']['input']>;
  merchantId?: InputMaybe<Scalars['ID']['input']>;
  money: MoneyInput;
  note?: InputMaybe<Scalars['String']['input']>;
  occurredAt: Scalars['DateTime']['input'];
  subscriptionId?: InputMaybe<Scalars['ID']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  taxDeductible?: InputMaybe<Scalars['Boolean']['input']>;
  type: TransactionType;
};

export type DashboardOverview = {
  __typename?: 'DashboardOverview';
  anomalies: Array<Anomaly>;
  budgets: Array<Budget>;
  expense: Money;
  expenseByCategory: Array<CategoryBreakdownItem>;
  income: Money;
  monthlyTrend: Array<MonthlySeriesPoint>;
  net: Money;
  period: DateRange;
  recentTransactions: Array<Transaction>;
  upcomingRenewals: Array<Subscription>;
};

export type DateRange = {
  __typename?: 'DateRange';
  from: Scalars['DateTime']['output'];
  to: Scalars['DateTime']['output'];
};

export type DateRangeInput = {
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
};

export type Document = {
  __typename?: 'Document';
  aiTags: Array<Scalars['String']['output']>;
  /** Presigned GET URL — short-lived, generated on demand. */
  downloadUrl: Scalars['String']['output'];
  extracted: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  language: Maybe<Scalars['String']['output']>;
  mimeType: Scalars['String']['output'];
  originalName: Maybe<Scalars['String']['output']>;
  processedAt: Maybe<Scalars['DateTime']['output']>;
  sizeBytes: Scalars['Int']['output'];
  status: DocumentStatus;
  summary: Maybe<Scalars['String']['output']>;
  transactions: Array<Transaction>;
  type: DocumentType;
  uploadedAt: Scalars['DateTime']['output'];
};

export type DocumentFilter = {
  dateRange?: InputMaybe<DateRangeInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<DocumentStatus>>;
  types?: InputMaybe<Array<DocumentType>>;
};

export type DocumentPage = {
  __typename?: 'DocumentPage';
  items: Array<Document>;
  pageInfo: PageInfo;
};

export type DocumentPayload = {
  __typename?: 'DocumentPayload';
  document: Document;
};

export enum DocumentStatus {
  Failed = 'FAILED',
  Processed = 'PROCESSED',
  Processing = 'PROCESSING',
  Uploaded = 'UPLOADED'
}

export enum DocumentType {
  Contract = 'CONTRACT',
  Invoice = 'INVOICE',
  Letter = 'LETTER',
  Other = 'OTHER',
  Receipt = 'RECEIPT',
  TaxDocument = 'TAX_DOCUMENT'
}

/** Step 1 of upload: the client requests a presigned URL. */
export type DocumentUploadTicket = {
  __typename?: 'DocumentUploadTicket';
  documentId: Scalars['ID']['output'];
  expiresAt: Scalars['DateTime']['output'];
  requiredHeaders: Scalars['JSON']['output'];
  storageKey: Scalars['String']['output'];
  uploadUrl: Scalars['String']['output'];
};

export enum Locale {
  Ar = 'ar',
  De = 'de',
  En = 'en',
  Fr = 'fr'
}

export type Merchant = {
  __typename?: 'Merchant';
  countryCode: Maybe<Scalars['String']['output']>;
  defaultCategory: Maybe<Category>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  logoUrl: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  website: Maybe<Scalars['String']['output']>;
};

/**
 * Money amount. `amountMinor` is always positive; direction is conveyed by the
 * enclosing entity (e.g. `Transaction.type`). `currency` is ISO 4217.
 */
export type Money = {
  __typename?: 'Money';
  amountMinor: Scalars['BigInt']['output'];
  currency: Scalars['String']['output'];
};

export type MoneyInput = {
  amountMinor: Scalars['BigInt']['input'];
  currency: Scalars['String']['input'];
};

export type MonthlySeriesPoint = {
  __typename?: 'MonthlySeriesPoint';
  expense: Money;
  income: Money;
  month: Scalars['DateTime']['output'];
  net: Money;
};

export type Mutation = {
  __typename?: 'Mutation';
  cancelSubscription: SubscriptionPayload;
  categorizeTransaction: TransactionPayload;
  changePassword: Scalars['Boolean']['output'];
  confirmDocumentUpload: DocumentPayload;
  createCategory: CategoryPayload;
  createSubscription: SubscriptionPayload;
  createTransaction: TransactionPayload;
  deleteAiConversation: Scalars['Boolean']['output'];
  deleteBudget: Scalars['Boolean']['output'];
  deleteCategory: Scalars['Boolean']['output'];
  deleteDocument: Scalars['Boolean']['output'];
  deleteTransaction: Scalars['Boolean']['output'];
  generateCancellationEmail: CancellationDraft;
  refreshToken: AuthPayload;
  reprocessDocument: DocumentPayload;
  requestDocumentUpload: DocumentUploadTicket;
  sendAiMessage: AiMessagePayload;
  sendCancellationEmail: Scalars['Boolean']['output'];
  setBudget: BudgetPayload;
  signIn: AuthPayload;
  signOut: Scalars['Boolean']['output'];
  signUp: AuthPayload;
  updateCategory: CategoryPayload;
  updateProfile: User;
  updateSubscription: SubscriptionPayload;
  updateTransaction: TransactionPayload;
};


export type MutationCancelSubscriptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCategorizeTransactionArgs = {
  categoryId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
};


export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
};


export type MutationConfirmDocumentUploadArgs = {
  input: ConfirmDocumentUploadInput;
};


export type MutationCreateCategoryArgs = {
  input: CreateCategoryInput;
};


export type MutationCreateSubscriptionArgs = {
  input: CreateSubscriptionInput;
};


export type MutationCreateTransactionArgs = {
  input: CreateTransactionInput;
};


export type MutationDeleteAiConversationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteBudgetArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationGenerateCancellationEmailArgs = {
  id: Scalars['ID']['input'];
  locale?: InputMaybe<Locale>;
};


export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};


export type MutationReprocessDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRequestDocumentUploadArgs = {
  input: RequestDocumentUploadInput;
};


export type MutationSendAiMessageArgs = {
  input: SendAiMessageInput;
};


export type MutationSendCancellationEmailArgs = {
  body: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  subject: Scalars['String']['input'];
};


export type MutationSetBudgetArgs = {
  input: SetBudgetInput;
};


export type MutationSignInArgs = {
  input: SignInInput;
};


export type MutationSignUpArgs = {
  input: SignUpInput;
};


export type MutationUpdateCategoryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCategoryInput;
};


export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};


export type MutationUpdateSubscriptionArgs = {
  id: Scalars['ID']['input'];
  input: UpdateSubscriptionInput;
};


export type MutationUpdateTransactionArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTransactionInput;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  hasMore: Scalars['Boolean']['output'];
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type PageInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type Query = {
  __typename?: 'Query';
  aiConversation: Maybe<AiConversation>;
  aiConversations: Array<AiConversation>;
  budgets: Array<Budget>;
  categories: Array<Category>;
  category: Maybe<Category>;
  dashboardOverview: DashboardOverview;
  document: Maybe<Document>;
  documents: DocumentPage;
  me: Maybe<User>;
  merchants: Array<Merchant>;
  subscription: Maybe<Subscription>;
  subscriptions: SubscriptionPage;
  taxSummary: TaxSummary;
  transaction: Maybe<Transaction>;
  transactions: TransactionPage;
};


export type QueryAiConversationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAiConversationsArgs = {
  page?: InputMaybe<PageInput>;
};


export type QueryBudgetsArgs = {
  period?: InputMaybe<DateRangeInput>;
};


export type QueryCategoriesArgs = {
  kind?: InputMaybe<CategoryKind>;
};


export type QueryCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDashboardOverviewArgs = {
  period: DateRangeInput;
};


export type QueryDocumentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDocumentsArgs = {
  filter?: InputMaybe<DocumentFilter>;
  page?: InputMaybe<PageInput>;
};


export type QueryMerchantsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySubscriptionArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySubscriptionsArgs = {
  filter?: InputMaybe<SubscriptionFilter>;
  page?: InputMaybe<PageInput>;
};


export type QueryTaxSummaryArgs = {
  year: Scalars['Int']['input'];
};


export type QueryTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTransactionsArgs = {
  filter?: InputMaybe<TransactionFilter>;
  page?: InputMaybe<PageInput>;
  sort?: InputMaybe<TransactionSort>;
};

export enum ReminderChannel {
  Email = 'EMAIL',
  InApp = 'IN_APP',
  Push = 'PUSH'
}

export type RequestDocumentUploadInput = {
  checksumSha256?: InputMaybe<Scalars['String']['input']>;
  mimeType: Scalars['String']['input'];
  originalName?: InputMaybe<Scalars['String']['input']>;
  sizeBytes: Scalars['Int']['input'];
  type: DocumentType;
};

export type SendAiMessageInput = {
  content: Scalars['String']['input'];
  conversationId?: InputMaybe<Scalars['ID']['input']>;
};

export type SetBudgetInput = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  money: MoneyInput;
  periodEnd: Scalars['DateTime']['input'];
  periodStart: Scalars['DateTime']['input'];
  rollover?: InputMaybe<Scalars['Boolean']['input']>;
};

export type SignInInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type SignUpInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  locale?: InputMaybe<Locale>;
  password: Scalars['String']['input'];
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Subscription = {
  __typename?: 'Subscription';
  autoDetected: Scalars['Boolean']['output'];
  billingCycle: BillingCycle;
  cancellationDeadline: Maybe<Scalars['DateTime']['output']>;
  cancellationUrl: Maybe<Scalars['String']['output']>;
  cancelledAt: Maybe<Scalars['DateTime']['output']>;
  category: Maybe<Category>;
  contactEmail: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  customCycleDays: Maybe<Scalars['Int']['output']>;
  description: Maybe<Scalars['String']['output']>;
  detectionConfidence: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  merchant: Maybe<Merchant>;
  money: Money;
  name: Scalars['String']['output'];
  nextRenewalAt: Maybe<Scalars['DateTime']['output']>;
  recentTransactions: Array<Transaction>;
  startedAt: Scalars['DateTime']['output'];
  status: SubscriptionStatus;
  upcomingReminder: Maybe<SubscriptionReminder>;
  updatedAt: Scalars['DateTime']['output'];
};


export type SubscriptionRecentTransactionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type SubscriptionFilter = {
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  renewalBefore?: InputMaybe<Scalars['DateTime']['input']>;
  statuses?: InputMaybe<Array<SubscriptionStatus>>;
};

export type SubscriptionPage = {
  __typename?: 'SubscriptionPage';
  items: Array<Subscription>;
  pageInfo: PageInfo;
};

export type SubscriptionPayload = {
  __typename?: 'SubscriptionPayload';
  subscription: Subscription;
};

export type SubscriptionReminder = {
  __typename?: 'SubscriptionReminder';
  channel: ReminderChannel;
  id: Scalars['ID']['output'];
  remindAt: Scalars['DateTime']['output'];
  sentAt: Maybe<Scalars['DateTime']['output']>;
};

export enum SubscriptionStatus {
  Active = 'ACTIVE',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
  Paused = 'PAUSED'
}

export type TaxCategoryTotal = {
  __typename?: 'TaxCategoryTotal';
  category: Category;
  total: Money;
  transactionCount: Scalars['Int']['output'];
};

export type TaxSummary = {
  __typename?: 'TaxSummary';
  byCategory: Array<TaxCategoryTotal>;
  estimatedSavings: Maybe<Money>;
  totalDeductible: Money;
  year: Scalars['Int']['output'];
};

export type Transaction = {
  __typename?: 'Transaction';
  aiConfidence: Maybe<Scalars['Float']['output']>;
  bookedAt: Maybe<Scalars['DateTime']['output']>;
  category: Maybe<Category>;
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  document: Maybe<Document>;
  exchangeRate: Maybe<Scalars['Decimal']['output']>;
  id: Scalars['ID']['output'];
  merchant: Maybe<Merchant>;
  money: Money;
  needsReview: Scalars['Boolean']['output'];
  note: Maybe<Scalars['String']['output']>;
  occurredAt: Scalars['DateTime']['output'];
  source: TransactionSource;
  subscription: Maybe<Subscription>;
  tags: Array<Scalars['String']['output']>;
  taxDeductible: Scalars['Boolean']['output'];
  type: TransactionType;
  updatedAt: Scalars['DateTime']['output'];
};

export type TransactionFilter = {
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  dateRange?: InputMaybe<DateRangeInput>;
  maxAmountMinor?: InputMaybe<Scalars['BigInt']['input']>;
  merchantIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  minAmountMinor?: InputMaybe<Scalars['BigInt']['input']>;
  needsReview?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  subscriptionId?: InputMaybe<Scalars['ID']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  types?: InputMaybe<Array<TransactionType>>;
};

export type TransactionPage = {
  __typename?: 'TransactionPage';
  items: Array<Transaction>;
  pageInfo: PageInfo;
};

export type TransactionPayload = {
  __typename?: 'TransactionPayload';
  transaction: Transaction;
};

export type TransactionSort = {
  direction?: InputMaybe<SortDirection>;
  field?: InputMaybe<TransactionSortField>;
};

export enum TransactionSortField {
  Amount = 'AMOUNT',
  CreatedAt = 'CREATED_AT',
  OccurredAt = 'OCCURRED_AT'
}

export enum TransactionSource {
  AiSuggested = 'AI_SUGGESTED',
  BankImport = 'BANK_IMPORT',
  Document = 'DOCUMENT',
  Email = 'EMAIL',
  Manual = 'MANUAL'
}

export enum TransactionType {
  Expense = 'EXPENSE',
  Income = 'INCOME',
  Transfer = 'TRANSFER'
}

export type UpdateCategoryInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  taxCode?: InputMaybe<Scalars['String']['input']>;
  taxDeductible?: InputMaybe<Scalars['Boolean']['input']>;
  translations?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateProfileInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  locale?: InputMaybe<Locale>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSubscriptionInput = {
  billingCycle?: InputMaybe<BillingCycle>;
  cancellationDeadline?: InputMaybe<Scalars['DateTime']['input']>;
  cancellationUrl?: InputMaybe<Scalars['String']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  contactEmail?: InputMaybe<Scalars['String']['input']>;
  customCycleDays?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  merchantId?: InputMaybe<Scalars['ID']['input']>;
  money?: InputMaybe<MoneyInput>;
  name?: InputMaybe<Scalars['String']['input']>;
  nextRenewalAt?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<SubscriptionStatus>;
};

export type UpdateTransactionInput = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  merchantId?: InputMaybe<Scalars['ID']['input']>;
  money?: InputMaybe<MoneyInput>;
  note?: InputMaybe<Scalars['String']['input']>;
  occurredAt?: InputMaybe<Scalars['DateTime']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  taxDeductible?: InputMaybe<Scalars['Boolean']['input']>;
  type?: InputMaybe<TransactionType>;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  displayName: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  locale: Locale;
  timezone: Scalars['String']['output'];
};
