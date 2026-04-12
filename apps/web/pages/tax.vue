<template>
  <div class="page">
    <header class="page__header">
      <h1>{{ t("tax.title") }}</h1>
      <UiSelect
        v-model="yearStr"
        :options="yearOptions"
        :label="t('tax.year')"
      />
    </header>

    <!-- ============================================================= -->
    <!-- Tax profile form                                                -->
    <!-- ============================================================= -->
    <UiCard :title="t('tax.profile.title')">
      <p class="page__hint">{{ t("tax.profile.intro") }}</p>

      <form class="tax-form" @submit.prevent="onSaveProfile">
        <div class="tax-form__row">
          <UiSelect
            v-model="profileForm.taxClass"
            :label="t('tax.profile.taxClass')"
            :options="taxClassOptions"
          />
          <label class="tax-form__check">
            <input
              v-model="profileForm.churchTax"
              type="checkbox"
            />
            <span>{{ t("tax.profile.churchTax") }}</span>
          </label>
        </div>

        <fieldset class="tax-form__group">
          <legend>{{ t("tax.profile.disability") }}</legend>
          <UiSelect
            v-model="profileForm.disabilityDegree"
            :label="t('tax.profile.disabilityDegree')"
            :options="disabilityOptions"
          />
          <div class="tax-form__merkzeichen">
            <label class="tax-form__check">
              <input v-model="profileForm.merkzeichenAG" type="checkbox" />
              <span>{{ t("tax.profile.merkzeichenAG") }}</span>
            </label>
            <label class="tax-form__check">
              <input v-model="profileForm.merkzeichenG" type="checkbox" />
              <span>{{ t("tax.profile.merkzeichenG") }}</span>
            </label>
            <label class="tax-form__check">
              <input v-model="profileForm.merkzeichenH" type="checkbox" />
              <span>{{ t("tax.profile.merkzeichenH") }}</span>
            </label>
            <label class="tax-form__check">
              <input v-model="profileForm.merkzeichenBl" type="checkbox" />
              <span>{{ t("tax.profile.merkzeichenBl") }}</span>
            </label>
            <label class="tax-form__check">
              <input v-model="profileForm.merkzeichenGl" type="checkbox" />
              <span>{{ t("tax.profile.merkzeichenGl") }}</span>
            </label>
            <label class="tax-form__check">
              <input v-model="profileForm.merkzeichenTBl" type="checkbox" />
              <span>{{ t("tax.profile.merkzeichenTBl") }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset class="tax-form__group">
          <legend>{{ t("tax.profile.deductions") }}</legend>
          <div class="tax-form__row">
            <UiInput
              v-model="profileForm.extraordinaryBurdens"
              type="number"
              :label="t('tax.profile.extraordinaryBurdens')"
              force-ltr
            />
            <UiInput
              v-model="profileForm.workExpenses"
              type="number"
              :label="t('tax.profile.workExpenses')"
              force-ltr
            />
          </div>
          <div class="tax-form__row">
            <UiInput
              v-model="profileForm.specialExpenses"
              type="number"
              :label="t('tax.profile.specialExpenses')"
              force-ltr
            />
            <UiInput
              v-model="profileForm.donations"
              type="number"
              :label="t('tax.profile.donations')"
              force-ltr
            />
          </div>
        </fieldset>

        <div class="tax-form__actions">
          <UiButton type="submit" :loading="profileSaving">
            {{ t("tax.profile.save") }}
          </UiButton>
          <span v-if="profileSaved" class="tax-form__saved">
            {{ t("tax.profile.saved") }}
          </span>
        </div>
      </form>
    </UiCard>

    <!-- ============================================================= -->
    <!-- Refund estimate                                                  -->
    <!-- ============================================================= -->
    <UiCard :title="t('tax.refund.title')">
      <div v-if="refund" class="refund">
        <div class="refund__hero">
          <UiStat
            v-if="refund.hasPayslipData"
            :label="refundLabel"
            :value="money.format(refundAbsolute)"
            :tone="refundTone"
          />
          <UiStat
            v-else
            :label="t('tax.refund.deductionsTotal')"
            :value="money.format(refund.deductions.total)"
            tone="positive"
          />
        </div>

        <p v-if="!refund.hasPayslipData" class="refund__hint">
          {{ t("tax.refund.noPayslipHint") }}
        </p>

        <div v-if="refund.hasPayslipData" class="refund__grid">
          <UiStat
            :label="t('tax.refund.taxablePrefix')"
            :value="money.format(refund.taxableIncome)"
          />
          <UiStat
            :label="t('tax.refund.taxPaid')"
            :value="money.format(refund.incomeTaxPaid)"
          />
          <UiStat
            :label="t('tax.refund.taxOwed')"
            :value="money.format(refund.taxOwed)"
            tone="negative"
          />
          <UiStat
            :label="t('tax.refund.deductionsTotal')"
            :value="money.format(refund.deductions.total)"
            tone="positive"
          />
        </div>

        <h3 class="refund__subhead">{{ t("tax.refund.breakdown") }}</h3>
        <dl class="refund__breakdown">
          <div>
            <dt>{{ t("tax.profile.workExpenses") }}</dt>
            <dd>{{ money.format(refund.deductions.workExpenses) }}</dd>
          </div>
          <div>
            <dt>{{ t("tax.profile.specialExpenses") }}</dt>
            <dd>{{ money.format(refund.deductions.specialExpenses) }}</dd>
          </div>
          <div
            v-if="Number(refund.deductions.disabilityPauschbetrag.amountMinor) > 0"
          >
            <dt>{{ t("tax.refund.disabilityPauschbetrag") }}</dt>
            <dd>{{ money.format(refund.deductions.disabilityPauschbetrag) }}</dd>
          </div>
          <div
            v-if="Number(refund.deductions.mobilityPauschbetrag.amountMinor) > 0"
          >
            <dt>{{ t("tax.refund.mobilityPauschbetrag") }}</dt>
            <dd>{{ money.format(refund.deductions.mobilityPauschbetrag) }}</dd>
          </div>
          <div
            v-if="Number(refund.deductions.extraordinaryBurdens.amountMinor) > 0"
          >
            <dt>{{ t("tax.profile.extraordinaryBurdens") }}</dt>
            <dd>{{ money.format(refund.deductions.extraordinaryBurdens) }}</dd>
          </div>
          <div v-if="Number(refund.deductions.donations.amountMinor) > 0">
            <dt>{{ t("tax.profile.donations") }}</dt>
            <dd>{{ money.format(refund.deductions.donations) }}</dd>
          </div>
        </dl>

        <p class="refund__disclaimer">{{ t("tax.refund.disclaimer") }}</p>
      </div>
    </UiCard>

    <!-- ============================================================= -->
    <!-- Salary block                                                     -->
    <!-- ============================================================= -->
    <UiCard :title="t('tax.salary')">
      <div v-if="salary && salary.monthsCovered > 0" class="salary">
        <div class="salary__stats">
          <UiStat :label="t('tax.gross')" :value="money.format(salary.gross)" />
          <UiStat
            :label="t('tax.net')"
            :value="money.format(salary.net)"
            tone="positive"
          />
          <UiStat
            :label="t('tax.incomeTax')"
            :value="money.format(salary.totalTax)"
            tone="negative"
          />
          <UiStat
            :label="t('tax.socialTotal')"
            :value="money.format(salary.totalSocial)"
          />
          <UiStat
            :label="t('tax.monthsCovered')"
            :value="salary.monthsCovered + ' / 12'"
          />
        </div>

        <h3 class="salary__subhead">{{ t("tax.projectedAnnual") }}</h3>
        <div class="salary__stats">
          <UiStat
            :label="t('tax.gross')"
            :value="money.format(salary.projectedAnnualGross)"
          />
          <UiStat
            :label="t('tax.net')"
            :value="money.format(salary.projectedAnnualNet)"
            tone="positive"
          />
          <UiStat
            :label="t('tax.incomeTax')"
            :value="money.format(salary.projectedAnnualTax)"
            tone="negative"
          />
        </div>

        <h3 class="salary__subhead">{{ t("tax.payslipEntries") }}</h3>
        <div class="slip-table">
          <div class="slip-table__row slip-table__row--head">
            <span>{{ t("tax.period") }}</span>
            <span>{{ t("tax.employer") }}</span>
            <span class="slip-table__amount">{{ t("tax.gross") }}</span>
            <span class="slip-table__amount">{{ t("tax.net") }}</span>
            <span class="slip-table__amount">{{ t("tax.incomeTax") }}</span>
          </div>
          <div
            v-for="entry in salary.entries"
            :key="entry.documentId"
            class="slip-table__row"
          >
            <span>{{ entry.periodStart ?? "—" }}</span>
            <span class="slip-table__employer">{{ entry.employerName ?? "—" }}</span>
            <span class="slip-table__amount">
              {{ entry.gross ? money.format(entry.gross) : "—" }}
            </span>
            <span class="slip-table__amount slip-table__amount--pos">
              {{ entry.net ? money.format(entry.net) : "—" }}
            </span>
            <span class="slip-table__amount slip-table__amount--neg">
              {{ entry.incomeTax ? money.format(entry.incomeTax) : "—" }}
            </span>
          </div>
        </div>
      </div>
      <p v-else class="page__empty-inline">{{ t("tax.salaryEmpty") }}</p>
    </UiCard>

    <!-- ============================================================= -->
    <!-- Deductible expenses summary                                      -->
    <!-- ============================================================= -->
    <div v-if="data?.taxSummary" class="tax-layout">
      <UiCard>
        <UiStat
          :label="t('tax.totalDeductible')"
          :value="money.format(data.taxSummary.totalDeductible)"
        />
        <UiStat
          v-if="data.taxSummary.estimatedSavings"
          :label="t('tax.estimatedSavings')"
          :value="money.format(data.taxSummary.estimatedSavings)"
          tone="positive"
        />
      </UiCard>

      <UiCard :title="t('tax.byCategory')">
        <ul class="tax-list">
          <li
            v-for="row in data.taxSummary.byCategory"
            :key="row.category.id"
          >
            <span
              class="tax-list__dot"
              :style="{ background: row.category.color ?? 'var(--border-strong)' }"
            />
            <span>{{ row.category.name }}</span>
            <span class="tax-list__amount">{{ money.format(row.total) }}</span>
            <span class="tax-list__count">{{ row.transactionCount }}</span>
          </li>
          <li v-if="data.taxSummary.byCategory.length === 0">
            {{ t("dashboard.noData") }}
          </li>
        </ul>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  SALARY_SUMMARY_QUERY,
  TAX_PROFILE_QUERY,
  TAX_REFUND_ESTIMATE_QUERY,
  TAX_SUMMARY_QUERY,
  UPDATE_TAX_PROFILE_MUTATION,
} from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const money = useMoney();

const currentYear = new Date().getUTCFullYear();
const yearStr = ref(String(currentYear));
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - i;
  return { value: String(y), label: String(y) };
});

// --- Tax summary + salary ---------------------------------------------------

const { data } = useQuery({
  query: TAX_SUMMARY_QUERY,
  variables: computed(() => ({ year: Number(yearStr.value) })),
});

const { data: salaryData } = useQuery({
  query: SALARY_SUMMARY_QUERY,
  variables: computed(() => ({ year: Number(yearStr.value) })),
});

const salary = computed(() => salaryData.value?.salarySummary ?? null);

// --- Tax profile ------------------------------------------------------------

const { data: profileData, execute: refetchProfile } = useQuery({
  query: TAX_PROFILE_QUERY,
});

const profileForm = ref({
  taxClass: "CLASS_1",
  churchTax: false,
  disabilityDegree: "",
  merkzeichenAG: false,
  merkzeichenG: false,
  merkzeichenH: false,
  merkzeichenBl: false,
  merkzeichenGl: false,
  merkzeichenTBl: false,
  extraordinaryBurdens: "",
  workExpenses: "",
  specialExpenses: "",
  donations: "",
});

watchEffect(() => {
  const p = profileData.value?.taxProfile;
  if (!p) return;
  profileForm.value = {
    taxClass: p.taxClass,
    churchTax: p.churchTax,
    disabilityDegree: p.disabilityDegree != null ? String(p.disabilityDegree) : "",
    merkzeichenAG: p.merkzeichenAG,
    merkzeichenG: p.merkzeichenG,
    merkzeichenH: p.merkzeichenH,
    merkzeichenBl: p.merkzeichenBl,
    merkzeichenGl: p.merkzeichenGl,
    merkzeichenTBl: p.merkzeichenTBl,
    extraordinaryBurdens: minorToMajorString(
      p.extraordinaryBurdens.amountMinor,
    ),
    workExpenses: minorToMajorString(p.workExpenses.amountMinor),
    specialExpenses: minorToMajorString(p.specialExpenses.amountMinor),
    donations: minorToMajorString(p.donations.amountMinor),
  };
});

const taxClassOptions = computed(() => [
  { value: "CLASS_1", label: t("tax.profile.class1") },
  { value: "CLASS_2", label: t("tax.profile.class2") },
  { value: "CLASS_3", label: t("tax.profile.class3") },
  { value: "CLASS_4", label: t("tax.profile.class4") },
  { value: "CLASS_5", label: t("tax.profile.class5") },
  { value: "CLASS_6", label: t("tax.profile.class6") },
]);

const disabilityOptions = computed(() => [
  { value: "", label: t("tax.profile.none") },
  ...[20, 30, 40, 50, 60, 70, 80, 90, 100].map((g) => ({
    value: String(g),
    label: `${g}`,
  })),
]);

const minorToMajorString = (v: string | bigint): string => {
  const n = typeof v === "bigint" ? v : BigInt(v);
  if (n === 0n) return "";
  return (Number(n) / 100).toString();
};

const majorStringToMinor = (v: string): string => {
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n < 0) return "0";
  return String(Math.round(n * 100));
};

const { execute: updateProfile } = useMutation(UPDATE_TAX_PROFILE_MUTATION);
const { execute: refetchRefund } = useQuery({
  query: TAX_REFUND_ESTIMATE_QUERY,
  variables: computed(() => ({ year: Number(yearStr.value) })),
});

const profileSaving = ref(false);
const profileSaved = ref(false);

const onSaveProfile = async (): Promise<void> => {
  profileSaving.value = true;
  profileSaved.value = false;
  try {
    await updateProfile({
      input: {
        taxClass: profileForm.value.taxClass,
        churchTax: profileForm.value.churchTax,
        disabilityDegree: profileForm.value.disabilityDegree
          ? Number.parseInt(profileForm.value.disabilityDegree, 10)
          : null,
        merkzeichenAG: profileForm.value.merkzeichenAG,
        merkzeichenG: profileForm.value.merkzeichenG,
        merkzeichenH: profileForm.value.merkzeichenH,
        merkzeichenBl: profileForm.value.merkzeichenBl,
        merkzeichenGl: profileForm.value.merkzeichenGl,
        merkzeichenTBl: profileForm.value.merkzeichenTBl,
        extraordinaryBurdensMinor: majorStringToMinor(
          profileForm.value.extraordinaryBurdens,
        ),
        workExpensesMinor: majorStringToMinor(profileForm.value.workExpenses),
        specialExpensesMinor: majorStringToMinor(
          profileForm.value.specialExpenses,
        ),
        donationsMinor: majorStringToMinor(profileForm.value.donations),
      },
    });
    await Promise.all([refetchProfile(), refetchRefund()]);
    profileSaved.value = true;
  } finally {
    profileSaving.value = false;
  }
};

// --- Refund estimate --------------------------------------------------------

const { data: refundData } = useQuery({
  query: TAX_REFUND_ESTIMATE_QUERY,
  variables: computed(() => ({ year: Number(yearStr.value) })),
});

const refund = computed(() => refundData.value?.taxRefundEstimate ?? null);

const refundMinor = computed(() =>
  refund.value ? BigInt(refund.value.refund.amountMinor) : 0n,
);

const refundTone = computed(() => {
  if (refundMinor.value > 0n) return "positive" as const;
  if (refundMinor.value < 0n) return "negative" as const;
  return "neutral" as const;
});

const refundLabel = computed(() =>
  refundMinor.value >= 0n
    ? t("tax.refund.estimated")
    : t("tax.refund.owed"),
);

const refundAbsolute = computed(() => {
  if (!refund.value) return { amountMinor: "0", currency: "EUR" };
  const abs = refundMinor.value < 0n ? -refundMinor.value : refundMinor.value;
  return { amountMinor: String(abs), currency: refund.value.refund.currency };
});
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-4);

    h1 {
      font-size: var(--fs-3xl);
      margin: 0;
    }
  }

  &__hint {
    color: var(--text-muted);
    margin: 0 0 var(--space-4);
    font-size: var(--fs-sm);
  }

  &__empty-inline {
    color: var(--text-muted);
    margin: 0;
  }
}

.tax-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-3);
  }

  &__group {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;

    legend {
      padding: 0 var(--space-2);
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  &__merkzeichen {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-2);
  }

  &__check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-sm);
    cursor: pointer;
    padding: var(--space-2) 0;

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  &__saved {
    color: var(--success);
    font-size: var(--fs-sm);
  }
}

.refund {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__hero {
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }

  &__subhead {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__breakdown {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-3);

    div {
      display: flex;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--surface-alt);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
    }

    dt {
      color: var(--text-muted);
      margin: 0;
    }

    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  }

  &__hint {
    color: var(--text-muted);
    font-size: var(--fs-sm);
    margin: 0;
    padding: var(--space-3);
    background: color-mix(in srgb, var(--brand-600) 8%, var(--surface));
    border-radius: var(--radius-sm);
  }

  &__disclaimer {
    margin: var(--space-4) 0 0;
    font-size: var(--fs-xs);
    color: var(--text-muted);
    font-style: italic;
  }
}

.tax-layout {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 2fr;
  gap: var(--space-4);
}

.salary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-3);
  }

  &__subhead {
    margin: var(--space-4) 0 0;
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

.slip-table {
  display: flex;
  flex-direction: column;

  &__row {
    display: grid;
    grid-template-columns: 110px 1.5fr 120px 120px 120px;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
    font-size: var(--fs-sm);
    align-items: center;

    &--head {
      font-weight: 600;
      color: var(--text-muted);
      font-size: var(--fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  &__employer {
    @include text-truncate;
  }

  &__amount {
    text-align: end;
    font-variant-numeric: tabular-nums;

    &--pos { color: var(--success); }
    &--neg { color: var(--danger); }
  }
}

.tax-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  font-size: var(--fs-sm);

  li {
    display: grid;
    grid-template-columns: 10px 1fr auto 60px;
    align-items: center;
    gap: var(--space-3);
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  &__amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  &__count {
    text-align: end;
    color: var(--text-muted);
  }
}
</style>
