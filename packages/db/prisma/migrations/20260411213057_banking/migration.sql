-- CreateEnum
CREATE TYPE "BankConnectionProvider" AS ENUM ('GOCARDLESS', 'CAMT_FILE');

-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('PENDING_CONSENT', 'ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BankConnectionProvider" NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "institutionId" TEXT,
    "institutionName" TEXT NOT NULL,
    "institutionLogo" TEXT,
    "countryCode" TEXT,
    "requisitionId" TEXT,
    "agreementId" TEXT,
    "consentExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "iban" TEXT,
    "bic" TEXT,
    "name" TEXT,
    "ownerName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "balanceMinor" BIGINT,
    "balanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "remittanceInfo" TEXT,
    "counterpartyName" TEXT,
    "counterpartyIban" TEXT,
    "endToEndId" TEXT,
    "raw" JSONB,
    "lifeosTransactionId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankConnection_userId_status_idx" ON "BankConnection"("userId", "status");

-- CreateIndex
CREATE INDEX "BankConnection_requisitionId_idx" ON "BankConnection"("requisitionId");

-- CreateIndex
CREATE INDEX "BankAccount_connectionId_idx" ON "BankAccount"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_connectionId_externalId_key" ON "BankAccount"("connectionId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_lifeosTransactionId_key" ON "BankTransaction"("lifeosTransactionId");

-- CreateIndex
CREATE INDEX "BankTransaction_accountId_bookingDate_idx" ON "BankTransaction"("accountId", "bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_accountId_externalId_key" ON "BankTransaction"("accountId", "externalId");

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_lifeosTransactionId_fkey" FOREIGN KEY ("lifeosTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
