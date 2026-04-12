<template>
  <div class="page">
    <header class="page__header">
      <h1>{{ t("budgets.title") }}</h1>
      <UiButton @click="openCreate">{{ t("budgets.new") }}</UiButton>
    </header>

    <div v-if="budgets.length" class="budget-grid">
      <UiCard v-for="b in budgets" :key="b.id">
        <template #header>
          <div class="budget-card__head">
            <h2 class="budget-card__name">
              {{ b.category?.name ?? t("budgets.overall") }}
            </h2>
            <div class="budget-card__actions">
              <UiButton variant="ghost" size="sm" @click="openEdit(b)">
                {{ t("common.edit") }}
              </UiButton>
              <UiButton variant="ghost" size="sm" @click="onDelete(b.id)">
                {{ t("common.delete") }}
              </UiButton>
            </div>
          </div>
        </template>

        <div class="budget-card__stats">
          <UiStat :label="t('budgets.spent')" :value="money.format(b.spent)" />
          <UiStat
            :label="t('budgets.remaining')"
            :value="money.format(b.remaining)"
            :tone="Number(b.remaining.amountMinor) < 0 ? 'negative' : 'positive'"
          />
        </div>

        <div class="budget-card__bar">
          <div
            class="budget-card__bar-fill"
            :style="{ width: `${Math.min(b.progress * 100, 100)}%` }"
            :class="{ 'budget-card__bar-fill--over': b.progress > 1 }"
          />
        </div>
        <p class="budget-card__meta">
          {{ dateFmt.date(b.periodStart) }} → {{ dateFmt.date(b.periodEnd) }}
          <span v-if="b.rollover"> · {{ t("budgets.rollover") }}</span>
        </p>
      </UiCard>
    </div>
    <p v-else class="page__empty">{{ t("budgets.empty") }}</p>

    <div v-if="showForm" class="modal" @click.self="showForm = false">
      <UiCard
        :title="editingId ? t('budgets.edit') : t('budgets.new')"
        class="modal__body"
      >
        <form class="budget-form" @submit.prevent="onSave">
          <UiSelect
            v-model="form.categoryId"
            :label="t('budgets.category')"
            :options="categoryOptions"
          />
          <UiInput
            v-model="form.amount"
            :label="t('budgets.amount')"
            type="number"
            required
            force-ltr
          />
          <UiSelect
            v-model="form.periodPreset"
            :label="t('budgets.period')"
            :options="periodPresetOptions"
          />
          <div v-if="form.periodPreset === 'custom'" class="budget-form__row">
            <UiInput
              v-model="form.from"
              :label="t('budgets.from')"
              type="date"
              force-ltr
            />
            <UiInput
              v-model="form.to"
              :label="t('budgets.to')"
              type="date"
              force-ltr
            />
          </div>
          <label class="budget-form__check">
            <input v-model="form.rollover" type="checkbox" />
            <span>{{ t("budgets.rollover") }}</span>
          </label>
          <div class="budget-form__actions">
            <UiButton variant="secondary" @click="showForm = false">
              {{ t("common.cancel") }}
            </UiButton>
            <UiButton type="submit">{{ t("budgets.save") }}</UiButton>
          </div>
        </form>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  BUDGETS_QUERY,
  CATEGORIES_QUERY,
  DELETE_BUDGET_MUTATION,
  SET_BUDGET_MUTATION,
} from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const money = useMoney();
const dateFmt = useDateFormat();

const { data, execute: refetch } = useQuery({ query: BUDGETS_QUERY });
const { data: categoriesData } = useQuery({ query: CATEGORIES_QUERY });

interface Money {
  amountMinor: string;
  currency: string;
}
interface BudgetShape {
  id: string;
  category: { id: string; name: string; color?: string | null } | null;
  money: Money;
  spent: Money;
  remaining: Money;
  progress: number;
  periodStart: string;
  periodEnd: string;
  rollover: boolean;
}

const budgets = computed<BudgetShape[]>(
  () => (data.value?.budgets ?? []) as BudgetShape[],
);

type PeriodPreset = "currentMonth" | "nextMonth" | "currentYear" | "custom";

const showForm = ref(false);
const editingId = ref<string | null>(null);

const form = ref({
  categoryId: "",
  amount: "",
  periodPreset: "currentMonth" as PeriodPreset,
  from: "",
  to: "",
  rollover: false,
});

const categoryOptions = computed(() => {
  const base = [{ value: "", label: t("budgets.overall") }];
  const cats = (categoriesData.value?.categories ?? []) as Array<{
    id: string;
    name: string;
    kind: string;
  }>;
  return [
    ...base,
    ...cats
      .filter((c) => c.kind === "EXPENSE")
      .map((c) => ({ value: c.id, label: c.name })),
  ];
});

const periodPresetOptions = computed(() => [
  { value: "currentMonth", label: t("budgets.currentMonth") },
  { value: "nextMonth", label: t("budgets.nextMonth") },
  { value: "currentYear", label: t("budgets.currentYear") },
  { value: "custom", label: t("budgets.custom") },
]);

const resolvePeriod = (): { from: Date; to: Date } => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (form.value.periodPreset) {
    case "currentMonth":
      return {
        from: new Date(Date.UTC(y, m, 1)),
        to: new Date(Date.UTC(y, m + 1, 1)),
      };
    case "nextMonth":
      return {
        from: new Date(Date.UTC(y, m + 1, 1)),
        to: new Date(Date.UTC(y, m + 2, 1)),
      };
    case "currentYear":
      return {
        from: new Date(Date.UTC(y, 0, 1)),
        to: new Date(Date.UTC(y + 1, 0, 1)),
      };
    case "custom":
      return {
        from: new Date(form.value.from || Date.UTC(y, m, 1)),
        to: new Date(form.value.to || Date.UTC(y, m + 1, 1)),
      };
  }
};

const openCreate = (): void => {
  editingId.value = null;
  form.value = {
    categoryId: "",
    amount: "",
    periodPreset: "currentMonth",
    from: "",
    to: "",
    rollover: false,
  };
  showForm.value = true;
};

const openEdit = (b: BudgetShape): void => {
  editingId.value = b.id;
  form.value = {
    categoryId: b.category?.id ?? "",
    amount: String(Number(b.money.amountMinor) / 100),
    periodPreset: "custom",
    from: b.periodStart.slice(0, 10),
    to: b.periodEnd.slice(0, 10),
    rollover: b.rollover,
  };
  showForm.value = true;
};

const { execute: setBudget } = useMutation(SET_BUDGET_MUTATION);
const { execute: deleteBudget } = useMutation(DELETE_BUDGET_MUTATION);

const onSave = async (): Promise<void> => {
  const amountMinor = Math.round(Number.parseFloat(form.value.amount) * 100);
  if (Number.isNaN(amountMinor) || amountMinor < 0) return;
  const { from, to } = resolvePeriod();
  await setBudget({
    input: {
      categoryId: form.value.categoryId || null,
      money: { amountMinor: String(amountMinor), currency: "EUR" },
      periodStart: from.toISOString(),
      periodEnd: to.toISOString(),
      rollover: form.value.rollover,
    },
  });
  showForm.value = false;
  await refetch();
};

const onDelete = async (id: string): Promise<void> => {
  if (!confirm(t("budgets.confirmDelete"))) return;
  await deleteBudget({ id });
  await refetch();
};
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h1 {
      font-size: var(--fs-3xl);
      margin: 0;
    }
  }

  &__empty {
    text-align: center;
    padding: var(--space-8) 0;
    color: var(--text-muted);
  }
}

.budget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.budget-card {
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
  }

  &__name {
    margin: 0;
    font-size: var(--fs-lg);
  }

  &__actions {
    display: flex;
    gap: var(--space-1);
  }

  &__stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  &__bar {
    height: 8px;
    background: var(--surface-alt);
    border-radius: var(--radius-pill);
    overflow: hidden;

    &-fill {
      height: 100%;
      background: var(--brand-500);
      transition: width 0.3s;

      &--over {
        background: var(--danger);
      }
    }
  }

  &__meta {
    margin: var(--space-3) 0 0;
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 50;

  &__body {
    width: 100%;
    max-width: 480px;
  }
}

.budget-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  &__check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-sm);
    cursor: pointer;

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
}
</style>
