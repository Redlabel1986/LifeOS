<template>
  <div class="page">
    <header class="page__header">
      <h1>{{ t("transactions.title") }}</h1>
      <div class="page__actions">
        <UiSelect
          v-model="period"
          :label="t('transactions.period')"
          :options="periodOptions"
        />
        <UiButton variant="secondary" @click="onExportCsv">{{ t("transactions.export") }}</UiButton>
        <UiButton @click="openCreate">{{ t("transactions.new") }}</UiButton>
      </div>
    </header>

    <div class="totals">
      <UiStat
        :label="t('transactions.totalIncome')"
        :value="totals ? money.format(totals.income) : '—'"
        tone="positive"
      />
      <UiStat
        :label="t('transactions.totalExpense')"
        :value="totals ? money.format(totals.expense) : '—'"
        tone="negative"
      />
      <UiStat
        :label="t('transactions.net')"
        :value="totals ? money.format(totals.net) : '—'"
        :tone="netTone"
      />
      <UiStat
        :label="t('transactions.transactionsCount')"
        :value="totals ? String(totals.transactionCount) : '—'"
      />
    </div>

    <UiCard>
      <div v-if="(data?.transactions?.items ?? []).length" class="tx-table">
        <div class="tx-table__row tx-table__row--head">
          <span>{{ t("transactions.date") }}</span>
          <span>{{ t("transactions.description") }}</span>
          <span>{{ t("transactions.category") }}</span>
          <span class="tx-table__amount">{{ t("transactions.amount") }}</span>
          <span />
        </div>
        <div
          v-for="tx in data?.transactions?.items ?? []"
          :key="tx.id"
          class="tx-table__row"
        >
          <span>{{ dateFmt.date(tx.occurredAt) }}</span>
          <span>
            <div>{{ tx.description ?? tx.merchant?.displayName ?? "—" }}</div>
            <div class="tx-table__sub">{{ tx.note }}</div>
          </span>
          <span>
            <UiCategoryPicker
              :model-value="tx.category?.id ?? null"
              :options="categoryPickerOptions(tx.type)"
              :current="tx.category"
              @change="(id) => onAssignCategory(tx.id, id)"
            />
          </span>
          <span
            :class="[
              'tx-table__amount',
              tx.type === 'EXPENSE' ? 'tx-table__amount--neg' : 'tx-table__amount--pos',
            ]"
          >
            {{ tx.type === "EXPENSE" ? "−" : "+" }}{{ money.format(tx.money) }}
          </span>
          <span class="tx-table__actions">
            <UiButton
              v-if="canPromote(tx)"
              variant="ghost"
              size="sm"
              :title="t('transactions.promoteToSubscription')"
              @click="onPromote(tx.id)"
            >
              ↻
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="onDelete(tx.id)">
              {{ t("common.delete") }}
            </UiButton>
          </span>
        </div>
      </div>
      <p v-else class="page__empty">{{ t("transactions.empty") }}</p>

      <UiPagination
        v-if="data?.transactions?.pageInfo"
        v-model="txOffset"
        :page-size="txPageSize"
        :total-count="data.transactions.pageInfo.totalCount"
        :has-more="data.transactions.pageInfo.hasMore"
      />
    </UiCard>

    <div v-if="showCreate" class="modal" @click.self="showCreate = false">
      <UiCard :title="t('transactions.new')" class="modal__body">
        <form class="tx-form" @submit.prevent="onCreate">
          <UiSelect
            v-model="form.type"
            :label="t('transactions.type')"
            :options="[
              { value: 'EXPENSE', label: t('transactions.expense') },
              { value: 'INCOME', label: t('transactions.income') },
            ]"
          />
          <UiInput
            v-model="form.amount"
            :label="t('transactions.amount')"
            type="number"
            required
            force-ltr
          />
          <UiInput
            v-model="form.date"
            :label="t('transactions.date')"
            type="date"
            required
            force-ltr
          />
          <UiSelect
            v-model="form.categoryId"
            :label="t('transactions.category')"
            :options="categoryOptions"
          />
          <UiInput
            v-model="form.description"
            :label="t('transactions.description')"
          />
          <div class="tx-form__actions">
            <UiButton variant="secondary" @click="showCreate = false">
              {{ t("common.cancel") }}
            </UiButton>
            <UiButton type="submit">{{ t("common.save") }}</UiButton>
          </div>
        </form>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  CATEGORIES_QUERY,
  CATEGORIZE_TRANSACTION_MUTATION,
  CREATE_TRANSACTION_MUTATION,
  DELETE_TRANSACTION_MUTATION,
  PROMOTE_TRANSACTION_TO_SUBSCRIPTION_MUTATION,
  TRANSACTIONS_CSV_QUERY,
  TRANSACTIONS_QUERY,
  TRANSACTION_TOTALS_QUERY,
} from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const money = useMoney();
const dateFmt = useDateFormat();

type Period = "all" | "thisMonth" | "lastMonth" | "thisYear";

const period = ref<Period>("thisYear");

const periodOptions = computed(() => [
  { value: "thisMonth", label: t("transactions.thisMonth") },
  { value: "lastMonth", label: t("transactions.lastMonth") },
  { value: "thisYear", label: t("transactions.thisYear") },
  { value: "all", label: t("transactions.allTime") },
]);

const periodRange = computed(() => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period.value) {
    case "thisMonth":
      return {
        from: new Date(Date.UTC(y, m, 1)).toISOString(),
        to: new Date(Date.UTC(y, m + 1, 1) - 1).toISOString(),
      };
    case "lastMonth":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
        to: new Date(Date.UTC(y, m, 1) - 1).toISOString(),
      };
    case "thisYear":
      return {
        from: new Date(Date.UTC(y, 0, 1)).toISOString(),
        to: new Date(Date.UTC(y + 1, 0, 1) - 1).toISOString(),
      };
    case "all":
      return null;
  }
});

const txFilter = computed(() =>
  periodRange.value ? { dateRange: periodRange.value } : undefined,
);

const txPageSize = 25;
const txOffset = ref(0);

// Reset offset when filter changes
watch(txFilter, () => {
  txOffset.value = 0;
});

const { data, execute: refetch } = useQuery({
  query: TRANSACTIONS_QUERY,
  variables: computed(() => ({
    filter: txFilter.value,
    page: { limit: txPageSize, offset: txOffset.value },
  })),
});

const { data: totalsData, execute: refetchTotals } = useQuery({
  query: TRANSACTION_TOTALS_QUERY,
  variables: computed(() => ({ filter: txFilter.value })),
});

const totals = computed(() => totalsData.value?.transactionTotals ?? null);

const netTone = computed(() => {
  if (!totals.value) return "neutral" as const;
  const n = BigInt(totals.value.net.amountMinor);
  if (n > 0n) return "positive" as const;
  if (n < 0n) return "negative" as const;
  return "neutral" as const;
});

const { data: categories } = useQuery({ query: CATEGORIES_QUERY });

interface CategoryShape {
  id: string;
  slug: string;
  kind: "INCOME" | "EXPENSE";
  name: string;
  color?: string | null;
}

const allCategories = computed<CategoryShape[]>(
  () => (categories.value?.categories ?? []) as CategoryShape[],
);

const categoryOptions = computed(() =>
  allCategories.value.map((c) => ({ value: c.id, label: c.name })),
);

/** Picker options filtered by transaction type (EXPENSE / INCOME). */
const categoryPickerOptions = (
  type: "INCOME" | "EXPENSE" | "TRANSFER",
): CategoryShape[] => {
  if (type === "TRANSFER") return allCategories.value;
  return allCategories.value.filter((c) => c.kind === type);
};

const showCreate = ref(false);
const form = ref({
  type: "EXPENSE",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  categoryId: null as string | null,
  description: "",
});

const openCreate = (): void => {
  showCreate.value = true;
  form.value = {
    type: "EXPENSE",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    categoryId: null,
    description: "",
  };
};

const { execute: createTx } = useMutation(CREATE_TRANSACTION_MUTATION);
const { execute: deleteTx } = useMutation(DELETE_TRANSACTION_MUTATION);
const { execute: categorizeTx } = useMutation(CATEGORIZE_TRANSACTION_MUTATION);
const { execute: promoteTx } = useMutation(
  PROMOTE_TRANSACTION_TO_SUBSCRIPTION_MUTATION,
);

const onAssignCategory = async (
  id: string,
  categoryId: string,
): Promise<void> => {
  await categorizeTx({ id, categoryId });
  await refreshAll();
};

interface TxRowShape {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: { slug: string } | null;
  subscription: { id: string } | null;
}

const canPromote = (tx: TxRowShape): boolean =>
  tx.type === "EXPENSE" &&
  tx.category?.slug === "subscriptions" &&
  !tx.subscription;

const onPromote = async (transactionId: string): Promise<void> => {
  await promoteTx({ transactionId });
  await refreshAll();
};

const refreshAll = async (): Promise<void> => {
  await Promise.all([refetch(), refetchTotals()]);
};

const onCreate = async (): Promise<void> => {
  const amount = Math.round(Number.parseFloat(form.value.amount) * 100);
  if (Number.isNaN(amount) || amount < 0) return;
  await createTx({
    input: {
      type: form.value.type,
      money: { amountMinor: String(amount), currency: "EUR" },
      occurredAt: new Date(form.value.date).toISOString(),
      categoryId: form.value.categoryId,
      description: form.value.description || null,
    },
  });
  showCreate.value = false;
  await refreshAll();
};

const onDelete = async (id: string): Promise<void> => {
  if (!confirm(t("transactions.confirmDelete"))) return;
  await deleteTx({ id });
  await refreshAll();
};

// --- CSV export -------------------------------------------------------------

const { execute: fetchCsv } = useQuery({
  query: TRANSACTIONS_CSV_QUERY,
  variables: computed(() => {
    const range = periodRange.value;
    return range ? { period: { from: range.from, to: range.to } } : {};
  }),
  fetchOnMount: false,
});

const onExportCsv = async (): Promise<void> => {
  const { data: csvData } = await fetchCsv();
  const csv = csvData?.transactionsCsv;
  if (!csv) return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifeos-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-4);

    h1 {
      font-size: var(--fs-3xl);
      margin: 0;
    }
  }

  &__actions {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
  }

  &__empty {
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-8) 0;
  }
}

.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}

.tx-table {
  display: flex;
  flex-direction: column;

  &__row {
    display: grid;
    grid-template-columns: 120px 2fr 1fr 140px 100px;
    gap: var(--space-4);
    padding: var(--space-3) 0;
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

  &__sub {
    color: var(--text-muted);
    font-size: var(--fs-xs);
  }

  &__cat {
    font-weight: 500;
  }

  &__uncategorized {
    color: var(--text-muted);
  }

  &__amount {
    text-align: end;
    font-variant-numeric: tabular-nums;
    font-weight: 600;

    &--neg { color: var(--danger); }
    &--pos { color: var(--success); }
  }

  &__actions {
    text-align: end;
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

.tx-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
}
</style>
