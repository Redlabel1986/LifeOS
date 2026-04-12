-- CreateEnum
CREATE TYPE "TaxClass" AS ENUM ('CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'CLASS_6');

-- CreateTable
CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxClass" "TaxClass" NOT NULL DEFAULT 'CLASS_1',
    "churchTax" BOOLEAN NOT NULL DEFAULT false,
    "disabilityDegree" INTEGER,
    "merkzeichenAG" BOOLEAN NOT NULL DEFAULT false,
    "merkzeichenG" BOOLEAN NOT NULL DEFAULT false,
    "merkzeichenH" BOOLEAN NOT NULL DEFAULT false,
    "merkzeichenBl" BOOLEAN NOT NULL DEFAULT false,
    "merkzeichenGl" BOOLEAN NOT NULL DEFAULT false,
    "merkzeichenTBl" BOOLEAN NOT NULL DEFAULT false,
    "extraordinaryBurdensMinor" BIGINT NOT NULL DEFAULT 0,
    "workExpensesMinor" BIGINT NOT NULL DEFAULT 0,
    "specialExpensesMinor" BIGINT NOT NULL DEFAULT 0,
    "donationsMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxProfile_userId_key" ON "TaxProfile"("userId");

-- AddForeignKey
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
