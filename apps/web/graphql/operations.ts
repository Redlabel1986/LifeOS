// ============================================================================
// apps/web — GraphQL operations
// ----------------------------------------------------------------------------
// Plain GraphQL document strings. Typed via hand-rolled interfaces for MVP —
// when @graphql-codegen/typescript-operations is wired this can become
// generated output.
// ============================================================================

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      email
      displayName
      locale
      currency
      timezone
      emailVerified
    }
  }
`;

export const SIGN_IN_MUTATION = /* GraphQL */ `
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      accessToken
      refreshToken
      expiresAt
      user {
        id
        email
        displayName
        locale
        currency
      }
    }
  }
`;

export const SIGN_UP_MUTATION = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      accessToken
      refreshToken
      expiresAt
      user {
        id
        email
        displayName
        locale
        currency
      }
    }
  }
`;

export const SIGN_OUT_MUTATION = /* GraphQL */ `
  mutation SignOut {
    signOut
  }
`;

export const UPDATE_PROFILE_MUTATION = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      displayName
      locale
      currency
      timezone
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = /* GraphQL */ `
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`;

export const CATEGORIES_QUERY = /* GraphQL */ `
  query Categories($kind: CategoryKind) {
    categories(kind: $kind) {
      id
      slug
      kind
      name
      icon
      color
      taxDeductible
      isSystem
    }
  }
`;

export const DASHBOARD_QUERY = /* GraphQL */ `
  query DashboardOverview($period: DateRangeInput!) {
    dashboardOverview(period: $period) {
      period { from to }
      income { amountMinor currency }
      expense { amountMinor currency }
      net { amountMinor currency }
      expenseByCategory {
        category { id slug name color }
        total { amountMinor currency }
        share
        transactionCount
      }
      monthlyTrend {
        month
        income { amountMinor currency }
        expense { amountMinor currency }
        net { amountMinor currency }
      }
      upcomingRenewals {
        id
        name
        nextRenewalAt
        money { amountMinor currency }
      }
      budgets {
        id
        category { id name }
        money { amountMinor currency }
        spent { amountMinor currency }
        remaining { amountMinor currency }
        progress
      }
      recentTransactions {
        id
        type
        occurredAt
        description
        money { amountMinor currency }
        category { id name }
        merchant { id displayName }
      }
      anomalies {
        id
        kind
        message
        severity
      }
    }
  }
`;

export const TRANSACTION_TOTALS_QUERY = /* GraphQL */ `
  query TransactionTotals($filter: TransactionFilter) {
    transactionTotals(filter: $filter) {
      income { amountMinor currency }
      expense { amountMinor currency }
      net { amountMinor currency }
      transactionCount
    }
  }
`;

export const TRANSACTIONS_QUERY = /* GraphQL */ `
  query Transactions(
    $filter: TransactionFilter
    $sort: TransactionSort
    $page: PageInput
  ) {
    transactions(filter: $filter, sort: $sort, page: $page) {
      items {
        id
        type
        source
        occurredAt
        description
        note
        tags
        taxDeductible
        money { amountMinor currency }
        category { id slug name color }
        merchant { id displayName }
        subscription { id name }
      }
      pageInfo { totalCount hasMore limit offset }
    }
  }
`;

export const CATEGORIZE_TRANSACTION_MUTATION = /* GraphQL */ `
  mutation CategorizeTransaction($id: ID!, $categoryId: ID!) {
    categorizeTransaction(id: $id, categoryId: $categoryId) {
      transaction {
        id
        category { id slug name color }
        needsReview
      }
    }
  }
`;

export const CREATE_TRANSACTION_MUTATION = /* GraphQL */ `
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      transaction { id }
    }
  }
`;

export const UPDATE_TRANSACTION_MUTATION = /* GraphQL */ `
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      transaction { id }
    }
  }
`;

export const TRANSACTIONS_CSV_QUERY = /* GraphQL */ `
  query TransactionsCsv($period: DateRangeInput) {
    transactionsCsv(period: $period)
  }
`;

export const DELETE_TRANSACTION_MUTATION = /* GraphQL */ `
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

export const SUBSCRIPTIONS_QUERY = /* GraphQL */ `
  query Subscriptions($filter: SubscriptionFilter, $page: PageInput) {
    subscriptions(filter: $filter, page: $page) {
      items {
        id
        name
        description
        status
        billingCycle
        money { amountMinor currency }
        startedAt
        nextRenewalAt
        cancellationDeadline
        autoDetected
        merchant { id displayName logoUrl }
        category { id name }
      }
      pageInfo { totalCount hasMore limit offset }
    }
  }
`;

export const CREATE_SUBSCRIPTION_MUTATION = /* GraphQL */ `
  mutation CreateSubscription($input: CreateSubscriptionInput!) {
    createSubscription(input: $input) {
      subscription { id }
    }
  }
`;

export const PROMOTE_TRANSACTION_TO_SUBSCRIPTION_MUTATION = /* GraphQL */ `
  mutation PromoteTransactionToSubscription(
    $transactionId: ID!
    $billingCycle: BillingCycle
  ) {
    promoteTransactionToSubscription(
      transactionId: $transactionId
      billingCycle: $billingCycle
    ) {
      subscription { id name status billingCycle }
    }
  }
`;

export const SUBSCRIPTION_PLAN_SUGGESTIONS_QUERY = /* GraphQL */ `
  query SubscriptionPlanSuggestions($serviceName: String!) {
    subscriptionPlanSuggestions(serviceName: $serviceName) {
      serviceName
      planName
      monthlyPriceCents
      currency
      billingCycle
      annualPriceCents
    }
  }
`;

export const UPDATE_SUBSCRIPTION_MUTATION = /* GraphQL */ `
  mutation UpdateSubscription($id: ID!, $input: UpdateSubscriptionInput!) {
    updateSubscription(id: $id, input: $input) {
      subscription { id name status billingCycle money { amountMinor currency } }
    }
  }
`;

export const CANCEL_SUBSCRIPTION_MUTATION = /* GraphQL */ `
  mutation CancelSubscription($id: ID!) {
    cancelSubscription(id: $id) {
      subscription { id status cancelledAt }
    }
  }
`;

export const GENERATE_CANCELLATION_EMAIL_MUTATION = /* GraphQL */ `
  mutation GenerateCancellationEmail($id: ID!, $locale: Locale) {
    generateCancellationEmail(id: $id, locale: $locale) {
      subject
      body
      recipient
      locale
    }
  }
`;

export const SEND_CANCELLATION_EMAIL_MUTATION = /* GraphQL */ `
  mutation SendCancellationEmail($id: ID!, $subject: String!, $body: String!) {
    sendCancellationEmail(id: $id, subject: $subject, body: $body)
  }
`;

export const DOCUMENTS_QUERY = /* GraphQL */ `
  query Documents($filter: DocumentFilter, $page: PageInput) {
    documents(filter: $filter, page: $page) {
      items {
        id
        type
        status
        mimeType
        sizeBytes
        originalName
        language
        summary
        aiTags
        extracted
        uploadedAt
        processedAt
      }
      pageInfo { totalCount hasMore limit offset }
    }
  }
`;

export const UPLOAD_DOCUMENT_MUTATION = /* GraphQL */ `
  mutation UploadDocument($input: UploadDocumentInput!) {
    uploadDocument(input: $input) {
      document { id status type }
    }
  }
`;

export const REQUEST_DOCUMENT_UPLOAD_MUTATION = /* GraphQL */ `
  mutation RequestDocumentUpload($input: RequestDocumentUploadInput!) {
    requestDocumentUpload(input: $input) {
      documentId
      uploadUrl
      storageKey
      expiresAt
      requiredHeaders
    }
  }
`;

export const CONFIRM_DOCUMENT_UPLOAD_MUTATION = /* GraphQL */ `
  mutation ConfirmDocumentUpload($input: ConfirmDocumentUploadInput!) {
    confirmDocumentUpload(input: $input) {
      document { id status }
    }
  }
`;

export const DELETE_DOCUMENT_MUTATION = /* GraphQL */ `
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id)
  }
`;

export const BUDGETS_QUERY = /* GraphQL */ `
  query Budgets($period: DateRangeInput) {
    budgets(period: $period) {
      id
      category { id slug name color }
      money { amountMinor currency }
      spent { amountMinor currency }
      remaining { amountMinor currency }
      progress
      periodStart
      periodEnd
      rollover
    }
  }
`;

export const SET_BUDGET_MUTATION = /* GraphQL */ `
  mutation SetBudget($input: SetBudgetInput!) {
    setBudget(input: $input) {
      budget { id }
    }
  }
`;

export const DELETE_BUDGET_MUTATION = /* GraphQL */ `
  mutation DeleteBudget($id: ID!) {
    deleteBudget(id: $id)
  }
`;

export const SALARY_SUMMARY_QUERY = /* GraphQL */ `
  query SalarySummary($year: Int!) {
    salarySummary(year: $year) {
      year
      monthsCovered
      gross { amountMinor currency }
      net { amountMinor currency }
      totalTax { amountMinor currency }
      totalSocial { amountMinor currency }
      projectedAnnualGross { amountMinor currency }
      projectedAnnualNet { amountMinor currency }
      projectedAnnualTax { amountMinor currency }
      entries {
        documentId
        periodStart
        periodEnd
        employerName
        gross { amountMinor currency }
        net { amountMinor currency }
        incomeTax { amountMinor currency }
        solidarityTax { amountMinor currency }
        churchTax { amountMinor currency }
        pensionInsurance { amountMinor currency }
        healthInsurance { amountMinor currency }
        unemploymentInsurance { amountMinor currency }
        careInsurance { amountMinor currency }
      }
    }
  }
`;

export const TAX_PROFILE_QUERY = /* GraphQL */ `
  query TaxProfile {
    taxProfile {
      id
      taxClass
      churchTax
      disabilityDegree
      merkzeichenAG
      merkzeichenG
      merkzeichenH
      merkzeichenBl
      merkzeichenGl
      merkzeichenTBl
      extraordinaryBurdens { amountMinor currency }
      workExpenses { amountMinor currency }
      specialExpenses { amountMinor currency }
      donations { amountMinor currency }
    }
  }
`;

export const UPDATE_TAX_PROFILE_MUTATION = /* GraphQL */ `
  mutation UpdateTaxProfile($input: UpdateTaxProfileInput!) {
    updateTaxProfile(input: $input) {
      id
      taxClass
      churchTax
      disabilityDegree
      merkzeichenAG
      merkzeichenG
      merkzeichenH
      merkzeichenBl
      merkzeichenGl
      merkzeichenTBl
      extraordinaryBurdens { amountMinor currency }
      workExpenses { amountMinor currency }
      specialExpenses { amountMinor currency }
      donations { amountMinor currency }
    }
  }
`;

export const TAX_REFUND_ESTIMATE_QUERY = /* GraphQL */ `
  query TaxRefundEstimate($year: Int!) {
    taxRefundEstimate(year: $year) {
      year
      hasPayslipData
      gross { amountMinor currency }
      incomeTaxPaid { amountMinor currency }
      taxableIncome { amountMinor currency }
      taxOwed { amountMinor currency }
      churchTax { amountMinor currency }
      refund { amountMinor currency }
      deductions {
        workExpenses { amountMinor currency }
        specialExpenses { amountMinor currency }
        disabilityPauschbetrag { amountMinor currency }
        mobilityPauschbetrag { amountMinor currency }
        extraordinaryBurdens { amountMinor currency }
        donations { amountMinor currency }
        total { amountMinor currency }
      }
    }
  }
`;

export const TAX_SUMMARY_QUERY = /* GraphQL */ `
  query TaxSummary($year: Int!) {
    taxSummary(year: $year) {
      year
      totalDeductible { amountMinor currency }
      estimatedSavings { amountMinor currency }
      byCategory {
        category { id name color }
        total { amountMinor currency }
        transactionCount
      }
    }
  }
`;

export const AI_CONVERSATIONS_QUERY = /* GraphQL */ `
  query AiConversations {
    aiConversations {
      id
      title
      updatedAt
    }
  }
`;

export const AI_CONVERSATION_QUERY = /* GraphQL */ `
  query AiConversation($id: ID!) {
    aiConversation(id: $id) {
      id
      title
      messages { id role content createdAt }
    }
  }
`;

export const SEND_AI_MESSAGE_MUTATION = /* GraphQL */ `
  mutation SendAiMessage($input: SendAiMessageInput!) {
    sendAiMessage(input: $input) {
      conversation {
        id
        title
        messages { id role content createdAt }
      }
      message { id role content }
    }
  }
`;

// ============================================================================
// Banking
// ============================================================================

export const BANKING_CONFIGURED_QUERY = /* GraphQL */ `
  query BankingConfigured {
    bankingConfigured
  }
`;

export const BANK_INSTITUTIONS_QUERY = /* GraphQL */ `
  query BankInstitutions($country: String) {
    bankInstitutions(country: $country) {
      id
      name
      bic
      logo
      transactionTotalDays
    }
  }
`;

export const BANK_CONNECTIONS_QUERY = /* GraphQL */ `
  query BankConnections {
    bankConnections {
      id
      provider
      status
      institutionName
      institutionLogo
      consentExpiresAt
      lastSyncedAt
      errorMessage
      createdAt
      accounts {
        id
        iban
        name
        ownerName
        currency
        transactionCount
        balance { amountMinor currency }
        balanceAt
      }
    }
  }
`;

export const CONNECT_BANK_MUTATION = /* GraphQL */ `
  mutation ConnectBank($input: ConnectBankInput!) {
    connectBank(input: $input) {
      consentUrl
      connectionId
    }
  }
`;

export const CONFIRM_BANK_CONNECTION_MUTATION = /* GraphQL */ `
  mutation ConfirmBankConnection($id: ID!) {
    confirmBankConnection(id: $id) {
      id
      status
      accounts { id iban name }
    }
  }
`;

export const SYNC_BANK_CONNECTION_MUTATION = /* GraphQL */ `
  mutation SyncBankConnection($connectionId: ID!) {
    syncBankConnection(connectionId: $connectionId) {
      newTransactions
      totalScanned
      errors
    }
  }
`;

export const DISCONNECT_BANK_MUTATION = /* GraphQL */ `
  mutation DisconnectBank($id: ID!) {
    disconnectBank(id: $id)
  }
`;

export const ANALYZE_BANK_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation AnalyzeBankAccount($accountId: ID, $force: Boolean) {
    analyzeBankAccount(accountId: $accountId, force: $force) {
      analyzed
      updated
    }
  }
`;

export const IMPORT_CAMT_FILE_MUTATION = /* GraphQL */ `
  mutation ImportCamtFile($input: ImportCamtInput!) {
    importCamtFile(input: $input) {
      connectionId
      accountId
      newTransactions
      totalScanned
      errors
    }
  }
`;
