// ============================================================================
// apps/api — Tax Summary
// ----------------------------------------------------------------------------
// Germany-first: aggregates tax-deductible expenses for a given year.
// ============================================================================

import { DocumentType, TaxClass, TransactionType } from "@lifeos/db";
import {
  estimateRefund,
  type DeTaxClass,
} from "@lifeos/utils";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import { MoneyRef } from "./shared.js";

builder.enumType(TaxClass, { name: "TaxClass" });

interface TaxCategoryTotalShape {
  categoryId: string;
  totalMinor: bigint;
  currency: string;
  transactionCount: number;
}

const TaxCategoryTotalRef = builder
  .objectRef<TaxCategoryTotalShape>("TaxCategoryTotal")
  .implement({
    fields: (t) => ({
      category: t.prismaField({
        type: "Category",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.category.findUniqueOrThrow({
            ...query,
            where: { id: parent.categoryId },
          }),
      }),
      total: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.totalMinor, currency: p.currency }),
      }),
      transactionCount: t.exposeInt("transactionCount"),
    }),
  });

interface TaxSummaryShape {
  year: number;
  totalDeductibleMinor: bigint;
  currency: string;
  byCategory: TaxCategoryTotalShape[];
  estimatedSavingsMinor: bigint | null;
}

const TaxSummaryRef = builder
  .objectRef<TaxSummaryShape>("TaxSummary")
  .implement({
    fields: (t) => ({
      year: t.exposeInt("year"),
      totalDeductible: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: p.totalDeductibleMinor,
          currency: p.currency,
        }),
      }),
      byCategory: t.field({
        type: [TaxCategoryTotalRef],
        resolve: (p) => p.byCategory,
      }),
      estimatedSavings: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.estimatedSavingsMinor !== null
            ? { amountMinor: p.estimatedSavingsMinor, currency: p.currency }
            : null,
      }),
    }),
  });

// ============================================================================
// Salary summary — aggregates payslip extractions for a year
// ============================================================================

interface PayslipEntryShape {
  documentId: string;
  periodStart: string | null;
  periodEnd: string | null;
  grossMinor: bigint | null;
  netMinor: bigint | null;
  incomeTaxMinor: bigint | null;
  solidarityTaxMinor: bigint | null;
  churchTaxMinor: bigint | null;
  pensionMinor: bigint | null;
  healthMinor: bigint | null;
  unemploymentMinor: bigint | null;
  careMinor: bigint | null;
  currency: string;
  employerName: string | null;
}

interface SalarySummaryShape {
  year: number;
  currency: string;
  entries: PayslipEntryShape[];
  // YTD totals (sum of all loaded payslips)
  grossMinor: bigint;
  netMinor: bigint;
  taxMinor: bigint;
  socialMinor: bigint;
  // Projected annual values: extrapolated from the monthly average
  projectedGrossMinor: bigint;
  projectedNetMinor: bigint;
  projectedTaxMinor: bigint;
  monthsCovered: number;
}

const PayslipEntryRef = builder
  .objectRef<PayslipEntryShape>("PayslipEntry")
  .implement({
    fields: (t) => ({
      documentId: t.exposeID("documentId"),
      periodStart: t.exposeString("periodStart", { nullable: true }),
      periodEnd: t.exposeString("periodEnd", { nullable: true }),
      employerName: t.exposeString("employerName", { nullable: true }),
      gross: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.grossMinor !== null
            ? { amountMinor: p.grossMinor, currency: p.currency }
            : null,
      }),
      net: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.netMinor !== null
            ? { amountMinor: p.netMinor, currency: p.currency }
            : null,
      }),
      incomeTax: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.incomeTaxMinor !== null
            ? { amountMinor: p.incomeTaxMinor, currency: p.currency }
            : null,
      }),
      solidarityTax: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.solidarityTaxMinor !== null
            ? { amountMinor: p.solidarityTaxMinor, currency: p.currency }
            : null,
      }),
      churchTax: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.churchTaxMinor !== null
            ? { amountMinor: p.churchTaxMinor, currency: p.currency }
            : null,
      }),
      pensionInsurance: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.pensionMinor !== null
            ? { amountMinor: p.pensionMinor, currency: p.currency }
            : null,
      }),
      healthInsurance: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.healthMinor !== null
            ? { amountMinor: p.healthMinor, currency: p.currency }
            : null,
      }),
      unemploymentInsurance: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.unemploymentMinor !== null
            ? { amountMinor: p.unemploymentMinor, currency: p.currency }
            : null,
      }),
      careInsurance: t.field({
        type: MoneyRef,
        nullable: true,
        resolve: (p) =>
          p.careMinor !== null
            ? { amountMinor: p.careMinor, currency: p.currency }
            : null,
      }),
    }),
  });

const SalarySummaryRef = builder
  .objectRef<SalarySummaryShape>("SalarySummary")
  .implement({
    fields: (t) => ({
      year: t.exposeInt("year"),
      monthsCovered: t.exposeInt("monthsCovered"),
      entries: t.field({
        type: [PayslipEntryRef],
        resolve: (p) => p.entries,
      }),
      gross: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.grossMinor, currency: p.currency }),
      }),
      net: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.netMinor, currency: p.currency }),
      }),
      totalTax: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.taxMinor, currency: p.currency }),
      }),
      totalSocial: t.field({
        type: MoneyRef,
        resolve: (p) => ({ amountMinor: p.socialMinor, currency: p.currency }),
      }),
      projectedAnnualGross: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: p.projectedGrossMinor,
          currency: p.currency,
        }),
      }),
      projectedAnnualNet: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: p.projectedNetMinor,
          currency: p.currency,
        }),
      }),
      projectedAnnualTax: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: p.projectedTaxMinor,
          currency: p.currency,
        }),
      }),
    }),
  });

const toMinor = (v: number | null | undefined): bigint | null => {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return BigInt(Math.round(v * 100));
};

builder.queryField("salarySummary", (t) =>
  t.field({
    type: SalarySummaryRef,
    args: { year: t.arg.int({ required: true }) },
    resolve: async (_parent, { year }, ctx) => {
      const user = requireUser(ctx);
      const from = new Date(Date.UTC(year, 0, 1));
      const to = new Date(Date.UTC(year + 1, 0, 1));

      const docs = await ctx.prisma.document.findMany({
        where: {
          userId: user.id,
          type: DocumentType.PAYSLIP,
          uploadedAt: { gte: from, lt: to },
        },
        orderBy: { uploadedAt: "asc" },
      });

      const entries: PayslipEntryShape[] = [];
      let grossMinor = 0n;
      let netMinor = 0n;
      let taxMinor = 0n;
      let socialMinor = 0n;
      let currency = user.currency;
      const monthKeys = new Set<string>();

      for (const doc of docs) {
        const extracted = doc.extracted as
          | { kind?: string; payslip?: Record<string, unknown> | null }
          | null;
        if (!extracted || extracted.kind !== "payslip" || !extracted.payslip)
          continue;
        const p = extracted.payslip as {
          periodStart?: string | null;
          periodEnd?: string | null;
          currency?: string;
          gross?: number | null;
          net?: number | null;
          incomeTax?: number | null;
          solidarityTax?: number | null;
          churchTax?: number | null;
          pensionInsurance?: number | null;
          healthInsurance?: number | null;
          unemploymentInsurance?: number | null;
          careInsurance?: number | null;
          employerName?: string | null;
        };

        const ccy = p.currency ?? currency;
        currency = ccy;

        const entry: PayslipEntryShape = {
          documentId: doc.id,
          periodStart: p.periodStart ?? null,
          periodEnd: p.periodEnd ?? null,
          grossMinor: toMinor(p.gross ?? null),
          netMinor: toMinor(p.net ?? null),
          incomeTaxMinor: toMinor(p.incomeTax ?? null),
          solidarityTaxMinor: toMinor(p.solidarityTax ?? null),
          churchTaxMinor: toMinor(p.churchTax ?? null),
          pensionMinor: toMinor(p.pensionInsurance ?? null),
          healthMinor: toMinor(p.healthInsurance ?? null),
          unemploymentMinor: toMinor(p.unemploymentInsurance ?? null),
          careMinor: toMinor(p.careInsurance ?? null),
          currency: ccy,
          employerName: p.employerName ?? null,
        };
        entries.push(entry);

        if (entry.grossMinor) grossMinor += entry.grossMinor;
        if (entry.netMinor) netMinor += entry.netMinor;
        if (entry.incomeTaxMinor) taxMinor += entry.incomeTaxMinor;
        if (entry.solidarityTaxMinor) taxMinor += entry.solidarityTaxMinor;
        if (entry.churchTaxMinor) taxMinor += entry.churchTaxMinor;
        if (entry.pensionMinor) socialMinor += entry.pensionMinor;
        if (entry.healthMinor) socialMinor += entry.healthMinor;
        if (entry.unemploymentMinor) socialMinor += entry.unemploymentMinor;
        if (entry.careMinor) socialMinor += entry.careMinor;

        if (entry.periodStart) {
          monthKeys.add(entry.periodStart.slice(0, 7));
        }
      }

      const monthsCovered = monthKeys.size || entries.length;
      const denom = monthsCovered > 0 ? BigInt(monthsCovered) : 1n;
      const projectedGrossMinor = (grossMinor * 12n) / denom;
      const projectedNetMinor = (netMinor * 12n) / denom;
      const projectedTaxMinor = (taxMinor * 12n) / denom;

      return {
        year,
        currency,
        entries,
        grossMinor,
        netMinor,
        taxMinor,
        socialMinor,
        projectedGrossMinor,
        projectedNetMinor,
        projectedTaxMinor,
        monthsCovered,
      };
    },
  }),
);

// ============================================================================
// Tax profile & refund estimator
// ============================================================================

builder.prismaObject("TaxProfile", {
  fields: (t) => ({
    id: t.exposeID("id"),
    taxClass: t.field({ type: TaxClass, resolve: (p) => p.taxClass }),
    churchTax: t.exposeBoolean("churchTax"),
    disabilityDegree: t.exposeInt("disabilityDegree", { nullable: true }),
    merkzeichenAG: t.exposeBoolean("merkzeichenAG"),
    merkzeichenG: t.exposeBoolean("merkzeichenG"),
    merkzeichenH: t.exposeBoolean("merkzeichenH"),
    merkzeichenBl: t.exposeBoolean("merkzeichenBl"),
    merkzeichenGl: t.exposeBoolean("merkzeichenGl"),
    merkzeichenTBl: t.exposeBoolean("merkzeichenTBl"),
    extraordinaryBurdens: t.field({
      type: MoneyRef,
      resolve: (p) => ({
        amountMinor: p.extraordinaryBurdensMinor,
        currency: "EUR",
      }),
    }),
    workExpenses: t.field({
      type: MoneyRef,
      resolve: (p) => ({
        amountMinor: p.workExpensesMinor,
        currency: "EUR",
      }),
    }),
    specialExpenses: t.field({
      type: MoneyRef,
      resolve: (p) => ({
        amountMinor: p.specialExpensesMinor,
        currency: "EUR",
      }),
    }),
    donations: t.field({
      type: MoneyRef,
      resolve: (p) => ({ amountMinor: p.donationsMinor, currency: "EUR" }),
    }),
  }),
});

const UpdateTaxProfileInput = builder.inputType("UpdateTaxProfileInput", {
  fields: (t) => ({
    taxClass: t.field({ type: TaxClass, required: false }),
    churchTax: t.boolean({ required: false }),
    disabilityDegree: t.int({ required: false }),
    merkzeichenAG: t.boolean({ required: false }),
    merkzeichenG: t.boolean({ required: false }),
    merkzeichenH: t.boolean({ required: false }),
    merkzeichenBl: t.boolean({ required: false }),
    merkzeichenGl: t.boolean({ required: false }),
    merkzeichenTBl: t.boolean({ required: false }),
    extraordinaryBurdensMinor: t.field({ type: "BigInt", required: false }),
    workExpensesMinor: t.field({ type: "BigInt", required: false }),
    specialExpensesMinor: t.field({ type: "BigInt", required: false }),
    donationsMinor: t.field({ type: "BigInt", required: false }),
  }),
});

builder.queryField("taxProfile", (t) =>
  t.prismaField({
    type: "TaxProfile",
    nullable: true,
    resolve: (query, _parent, _args, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.taxProfile.findUnique({
        ...query,
        where: { userId: user.id },
      });
    },
  }),
);

builder.mutationField("updateTaxProfile", (t) =>
  t.prismaField({
    type: "TaxProfile",
    args: { input: t.arg({ type: UpdateTaxProfileInput, required: true }) },
    resolve: async (query, _parent, { input }, ctx) => {
      const user = requireUser(ctx);
      const disabilityDegree =
        input.disabilityDegree === undefined ? undefined : input.disabilityDegree;
      return ctx.prisma.taxProfile.upsert({
        ...query,
        where: { userId: user.id },
        create: {
          userId: user.id,
          taxClass: input.taxClass ?? TaxClass.CLASS_1,
          churchTax: input.churchTax ?? false,
          disabilityDegree: disabilityDegree ?? null,
          merkzeichenAG: input.merkzeichenAG ?? false,
          merkzeichenG: input.merkzeichenG ?? false,
          merkzeichenH: input.merkzeichenH ?? false,
          merkzeichenBl: input.merkzeichenBl ?? false,
          merkzeichenGl: input.merkzeichenGl ?? false,
          merkzeichenTBl: input.merkzeichenTBl ?? false,
          extraordinaryBurdensMinor: input.extraordinaryBurdensMinor
            ? BigInt(input.extraordinaryBurdensMinor)
            : 0n,
          workExpensesMinor: input.workExpensesMinor
            ? BigInt(input.workExpensesMinor)
            : 0n,
          specialExpensesMinor: input.specialExpensesMinor
            ? BigInt(input.specialExpensesMinor)
            : 0n,
          donationsMinor: input.donationsMinor
            ? BigInt(input.donationsMinor)
            : 0n,
        },
        update: {
          taxClass: input.taxClass ?? undefined,
          churchTax: input.churchTax ?? undefined,
          disabilityDegree: disabilityDegree,
          merkzeichenAG: input.merkzeichenAG ?? undefined,
          merkzeichenG: input.merkzeichenG ?? undefined,
          merkzeichenH: input.merkzeichenH ?? undefined,
          merkzeichenBl: input.merkzeichenBl ?? undefined,
          merkzeichenGl: input.merkzeichenGl ?? undefined,
          merkzeichenTBl: input.merkzeichenTBl ?? undefined,
          extraordinaryBurdensMinor:
            input.extraordinaryBurdensMinor !== undefined &&
            input.extraordinaryBurdensMinor !== null
              ? BigInt(input.extraordinaryBurdensMinor)
              : undefined,
          workExpensesMinor:
            input.workExpensesMinor !== undefined &&
            input.workExpensesMinor !== null
              ? BigInt(input.workExpensesMinor)
              : undefined,
          specialExpensesMinor:
            input.specialExpensesMinor !== undefined &&
            input.specialExpensesMinor !== null
              ? BigInt(input.specialExpensesMinor)
              : undefined,
          donationsMinor:
            input.donationsMinor !== undefined &&
            input.donationsMinor !== null
              ? BigInt(input.donationsMinor)
              : undefined,
        },
      });
    },
  }),
);

// --- Refund estimate --------------------------------------------------------

interface RefundDeductionsShape {
  workExpensesEur: number;
  specialExpensesEur: number;
  disabilityPauschbetragEur: number;
  mobilityPauschbetragEur: number;
  extraordinaryBurdensEur: number;
  donationsEur: number;
  totalEur: number;
}

const RefundDeductionsRef = builder
  .objectRef<RefundDeductionsShape>("RefundDeductions")
  .implement({
    fields: (t) => ({
      workExpenses: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.workExpensesEur * 100)),
          currency: "EUR",
        }),
      }),
      specialExpenses: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.specialExpensesEur * 100)),
          currency: "EUR",
        }),
      }),
      disabilityPauschbetrag: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.disabilityPauschbetragEur * 100)),
          currency: "EUR",
        }),
      }),
      mobilityPauschbetrag: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.mobilityPauschbetragEur * 100)),
          currency: "EUR",
        }),
      }),
      extraordinaryBurdens: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.extraordinaryBurdensEur * 100)),
          currency: "EUR",
        }),
      }),
      donations: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.donationsEur * 100)),
          currency: "EUR",
        }),
      }),
      total: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.totalEur * 100)),
          currency: "EUR",
        }),
      }),
    }),
  });

interface RefundEstimateShape {
  year: number;
  hasPayslipData: boolean;
  grossEur: number;
  incomeTaxPaidEur: number;
  taxableIncomeEur: number;
  taxOwedEur: number;
  churchTaxEur: number;
  refundEur: number;
  deductions: RefundDeductionsShape;
}

const RefundEstimateRef = builder
  .objectRef<RefundEstimateShape>("RefundEstimate")
  .implement({
    fields: (t) => ({
      year: t.exposeInt("year"),
      hasPayslipData: t.exposeBoolean("hasPayslipData"),
      gross: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.grossEur * 100)),
          currency: "EUR",
        }),
      }),
      incomeTaxPaid: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.incomeTaxPaidEur * 100)),
          currency: "EUR",
        }),
      }),
      taxableIncome: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.taxableIncomeEur * 100)),
          currency: "EUR",
        }),
      }),
      taxOwed: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.taxOwedEur * 100)),
          currency: "EUR",
        }),
      }),
      churchTax: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.churchTaxEur * 100)),
          currency: "EUR",
        }),
      }),
      refund: t.field({
        type: MoneyRef,
        resolve: (p) => ({
          amountMinor: BigInt(Math.round(p.refundEur * 100)),
          currency: "EUR",
        }),
      }),
      deductions: t.field({
        type: RefundDeductionsRef,
        resolve: (p) => p.deductions,
      }),
    }),
  });

builder.queryField("taxRefundEstimate", (t) =>
  t.field({
    type: RefundEstimateRef,
    args: { year: t.arg.int({ required: true }) },
    resolve: async (_parent, { year }, ctx) => {
      const user = requireUser(ctx);

      const profile = await ctx.prisma.taxProfile.findUnique({
        where: { userId: user.id },
      });

      // Pull all PAYSLIP documents for the year and aggregate.
      const from = new Date(Date.UTC(year, 0, 1));
      const to = new Date(Date.UTC(year + 1, 0, 1));
      const docs = await ctx.prisma.document.findMany({
        where: {
          userId: user.id,
          type: DocumentType.PAYSLIP,
          uploadedAt: { gte: from, lt: to },
        },
      });

      let grossSum = 0;
      let taxSum = 0;
      let socialSum = 0;
      const monthKeys = new Set<string>();
      for (const doc of docs) {
        const extracted = doc.extracted as
          | { kind?: string; payslip?: Record<string, unknown> | null }
          | null;
        if (!extracted || extracted.kind !== "payslip" || !extracted.payslip)
          continue;
        const p = extracted.payslip as {
          periodStart?: string | null;
          gross?: number | null;
          incomeTax?: number | null;
          solidarityTax?: number | null;
          churchTax?: number | null;
          pensionInsurance?: number | null;
          healthInsurance?: number | null;
          unemploymentInsurance?: number | null;
          careInsurance?: number | null;
        };
        if (typeof p.gross === "number") grossSum += p.gross;
        if (typeof p.incomeTax === "number") taxSum += p.incomeTax;
        if (typeof p.solidarityTax === "number") taxSum += p.solidarityTax;
        if (typeof p.churchTax === "number") taxSum += p.churchTax;
        if (typeof p.pensionInsurance === "number") socialSum += p.pensionInsurance;
        if (typeof p.healthInsurance === "number") socialSum += p.healthInsurance;
        if (typeof p.unemploymentInsurance === "number") socialSum += p.unemploymentInsurance;
        if (typeof p.careInsurance === "number") socialSum += p.careInsurance;
        if (p.periodStart) monthKeys.add(p.periodStart.slice(0, 7));
      }

      const monthsCovered = monthKeys.size || docs.length;
      const hasPayslipData = monthsCovered > 0;

      // Project to a full year if we only have partial data.
      const projectedGross =
        monthsCovered > 0 ? (grossSum * 12) / monthsCovered : 0;
      const projectedTaxPaid =
        monthsCovered > 0 ? (taxSum * 12) / monthsCovered : 0;
      const projectedSocial =
        monthsCovered > 0 ? (socialSum * 12) / monthsCovered : 0;

      const taxClass = (profile?.taxClass ?? "CLASS_1") as DeTaxClass;

      const disability = {
        degree: profile?.disabilityDegree ?? null,
        merkzeichenAG: profile?.merkzeichenAG ?? false,
        merkzeichenG: profile?.merkzeichenG ?? false,
        merkzeichenH: profile?.merkzeichenH ?? false,
        merkzeichenBl: profile?.merkzeichenBl ?? false,
        merkzeichenGl: profile?.merkzeichenGl ?? false,
        merkzeichenTBl: profile?.merkzeichenTBl ?? false,
      };

      const result = estimateRefund({
        year,
        taxClass,
        churchTax: profile?.churchTax ?? false,
        disability,
        grossEur: projectedGross,
        incomeTaxPaidEur: projectedTaxPaid,
        socialContributionsEur: projectedSocial > 0 ? projectedSocial : undefined,
        workExpensesEur: Number(profile?.workExpensesMinor ?? 0n) / 100,
        specialExpensesEur:
          Number(profile?.specialExpensesMinor ?? 0n) / 100,
        extraordinaryBurdensEur:
          Number(profile?.extraordinaryBurdensMinor ?? 0n) / 100,
        donationsEur: Number(profile?.donationsMinor ?? 0n) / 100,
      });

      return {
        year,
        hasPayslipData,
        grossEur: projectedGross,
        incomeTaxPaidEur: projectedTaxPaid,
        taxableIncomeEur: result.taxableIncomeEur,
        taxOwedEur: result.taxOwedEur,
        churchTaxEur: result.churchTaxEur,
        refundEur: result.refundEur,
        deductions: {
          workExpensesEur: result.deductions.workExpensesEur,
          specialExpensesEur: result.deductions.specialExpensesEur,
          disabilityPauschbetragEur: result.deductions.disabilityPauschbetragEur,
          mobilityPauschbetragEur: result.deductions.mobilityPauschbetragEur,
          extraordinaryBurdensEur: result.deductions.extraordinaryBurdensEur,
          donationsEur: result.deductions.donationsEur,
          totalEur: result.deductions.total,
        },
      };
    },
  }),
);

builder.queryField("taxSummary", (t) =>
  t.field({
    type: TaxSummaryRef,
    args: { year: t.arg.int({ required: true }) },
    resolve: async (_parent, { year }, ctx) => {
      const user = requireUser(ctx);
      const from = new Date(Date.UTC(year, 0, 1));
      const to = new Date(Date.UTC(year + 1, 0, 1));

      const [txs, profile] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where: {
            userId: user.id,
            type: TransactionType.EXPENSE,
            taxDeductible: true,
            currency: user.currency,
            occurredAt: { gte: from, lt: to },
          },
          select: { amountMinor: true, categoryId: true },
        }),
        ctx.prisma.taxProfile.findUnique({ where: { userId: user.id } }),
      ]);

      let total = 0n;
      const byCat = new Map<string, { totalMinor: bigint; count: number }>();
      for (const tx of txs) {
        total += tx.amountMinor;
        if (!tx.categoryId) continue;
        const entry = byCat.get(tx.categoryId) ?? {
          totalMinor: 0n,
          count: 0,
        };
        entry.totalMinor += tx.amountMinor;
        entry.count += 1;
        byCat.set(tx.categoryId, entry);
      }

      const byCategory: TaxCategoryTotalShape[] = Array.from(byCat.entries())
        .map(([categoryId, v]) => ({
          categoryId,
          totalMinor: v.totalMinor,
          currency: user.currency,
          transactionCount: v.count,
        }))
        .sort((a, b) => Number(b.totalMinor - a.totalMinor));

      // Estimate savings using the user's tax class marginal rate.
      // Uses simplified marginal rates per Steuerklasse.
      let marginalRate = 30n;
      if (profile) {
        const rateMap: Record<string, bigint> = {
          CLASS_1: 35n,
          CLASS_2: 35n,
          CLASS_3: 25n,
          CLASS_4: 35n,
          CLASS_5: 42n,
          CLASS_6: 42n,
        };
        marginalRate = rateMap[profile.taxClass] ?? 30n;
      }
      const estimatedSavingsMinor = (total * marginalRate) / 100n;

      return {
        year,
        totalDeductibleMinor: total,
        currency: user.currency,
        byCategory,
        estimatedSavingsMinor,
      };
    },
  }),
);
