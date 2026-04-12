<template>
  <div class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">{{ t("dashboard.title") }}</h1>
      <div class="dashboard__controls">
        <div class="month-nav">
          <UiButton variant="ghost" size="sm" @click="prevMonth">&larr;</UiButton>
          <span class="month-nav__label">{{ monthLabel }}</span>
          <UiButton variant="ghost" size="sm" :disabled="isCurrentMonth" @click="nextMonth">&rarr;</UiButton>
        </div>
        <UiSelect
          v-model="selectedCategoryId"
          :label="t('dashboard.filterCategory')"
          :options="categoryFilterOptions"
        />
      </div>
    </header>

    <!-- KPI Row -->
    <div v-if="data" class="dashboard__kpis">
      <div class="kpi kpi--income">
        <span class="kpi__label">{{ t("dashboard.income") }}</span>
        <span class="kpi__value">{{ money.format(filteredIncome) }}</span>
      </div>
      <div class="kpi kpi--expense">
        <span class="kpi__label">{{ t("dashboard.expense") }}</span>
        <span class="kpi__value">{{ money.format(filteredExpense) }}</span>
      </div>
      <div class="kpi" :class="netClass">
        <span class="kpi__label">{{ t("dashboard.net") }}</span>
        <span class="kpi__value">{{ money.format(filteredNet) }}</span>
      </div>
      <div class="kpi kpi--rate">
        <span class="kpi__label">{{ t("dashboard.savingsRate") }}</span>
        <span class="kpi__value">{{ savingsRate }}%</span>
        <span class="kpi__hint">{{ t("dashboard.ofIncome") }}</span>
      </div>
    </div>

    <div v-if="data" class="dashboard__grid">
      <!-- Donut chart — expense by category -->
      <UiCard :title="t('dashboard.byCategory')" class="dashboard__chart-card">
        <div v-if="filteredByCategory.length" class="donut-wrap">
          <canvas ref="donutCanvas" />
        </div>
        <ul class="category-legend">
          <li v-for="item in filteredByCategory" :key="item.category?.id ?? 'uncategorized'">
            <span class="category-legend__dot" :style="{ background: item.category?.color ?? '#475569' }" />
            <span class="category-legend__name">{{ item.category?.name ?? t("transactions.category") }}</span>
            <span class="category-legend__amount">{{ money.format(item.total) }}</span>
            <span class="category-legend__pct">{{ Math.round(item.share * 100) }}%</span>
          </li>
          <li v-if="!filteredByCategory.length" class="empty">{{ t("dashboard.noData") }}</li>
        </ul>
      </UiCard>

      <!-- Budget progress -->
      <UiCard :title="t('dashboard.budgets')">
        <div v-if="data.dashboardOverview.budgets.length" class="budget-list">
          <div v-for="b in data.dashboardOverview.budgets" :key="b.id" class="budget-item">
            <div class="budget-item__header">
              <span class="budget-item__name">{{ b.category?.name ?? "—" }}</span>
              <span class="budget-item__amounts">
                {{ money.format(b.spent) }} / {{ money.format(b.money) }}
              </span>
            </div>
            <div class="budget-item__bar">
              <div
                class="budget-item__fill"
                :class="{ 'budget-item__fill--over': b.progress > 1 }"
                :style="{ width: Math.min(b.progress * 100, 100) + '%' }"
              />
            </div>
            <span class="budget-item__remaining" :class="{ 'budget-item__remaining--over': Number(b.remaining.amountMinor) < 0 }">
              {{ Number(b.remaining.amountMinor) >= 0
                ? t("dashboard.remaining", { amount: money.format(b.remaining) })
                : t("dashboard.exceeded", { amount: money.format({ amountMinor: String(-BigInt(b.remaining.amountMinor)), currency: b.remaining.currency }) })
              }}
            </span>
          </div>
        </div>
        <p v-else class="empty">{{ t("dashboard.noData") }}</p>
      </UiCard>

      <!-- Forecast -->
      <UiCard :title="t('dashboard.forecast')">
        <div class="forecast">
          <div class="forecast__item">
            <span class="forecast__label">{{ t("dashboard.avgExpenseDay") }}</span>
            <span class="forecast__value">{{ money.format(avgDailyExpense) }}</span>
          </div>
          <div class="forecast__item">
            <span class="forecast__label">{{ t("dashboard.projectedExpense") }}</span>
            <span class="forecast__value forecast__value--dim">{{ money.format(projectedMonthlyExpense) }}</span>
          </div>
          <div class="forecast__item">
            <span class="forecast__label">{{ t("dashboard.projectedNet") }}</span>
            <span class="forecast__value" :class="projectedNetNegative ? 'forecast__value--neg' : 'forecast__value--pos'">
              {{ money.format(projectedNet) }}
            </span>
          </div>
        </div>
      </UiCard>

      <!-- Upcoming renewals -->
      <UiCard :title="t('dashboard.upcomingRenewals')">
        <ul class="renewal-list">
          <li v-for="sub in data.dashboardOverview.upcomingRenewals" :key="sub.id">
            <span class="renewal-list__name">{{ sub.name }}</span>
            <span class="renewal-list__amount">{{ money.format(sub.money) }}</span>
            <span class="renewal-list__date">{{ dateFmt.date(sub.nextRenewalAt) }}</span>
          </li>
          <li v-if="!data.dashboardOverview.upcomingRenewals.length" class="empty">{{ t("dashboard.noData") }}</li>
        </ul>
      </UiCard>

      <!-- Recent transactions -->
      <UiCard :title="t('dashboard.recentTransactions')" class="dashboard__wide">
        <ul class="tx-list">
          <li v-for="tx in filteredRecentTransactions" :key="tx.id">
            <div class="tx-list__left">
              <span class="tx-list__desc">{{ tx.description ?? tx.merchant?.displayName ?? "\u2014" }}</span>
              <span class="tx-list__meta">{{ dateFmt.date(tx.occurredAt) }} &middot; {{ tx.category?.name ?? "" }}</span>
            </div>
            <span :class="['tx-list__amount', tx.type === 'EXPENSE' ? 'tx-list__amount--neg' : 'tx-list__amount--pos']">
              {{ tx.type === "EXPENSE" ? "\u2212" : "+" }}{{ money.format(tx.money) }}
            </span>
          </li>
          <li v-if="!data.dashboardOverview.recentTransactions.length" class="empty">{{ t("dashboard.noData") }}</li>
        </ul>
      </UiCard>

      <!-- Anomalies -->
      <UiCard v-if="data.dashboardOverview.anomalies.length" :title="t('dashboard.anomalies')">
        <ul class="anomaly-list">
          <li v-for="a in data.dashboardOverview.anomalies" :key="a.id" :class="`anomaly--${a.severity}`">
            {{ a.message }}
          </li>
        </ul>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from "villus";
import { CATEGORIES_QUERY, DASHBOARD_QUERY } from "~/graphql/operations";
import { Chart as ChartJS, ArcElement, Tooltip, DoughnutController } from "chart.js";

ChartJS.register(ArcElement, Tooltip, DoughnutController);

definePageMeta({ middleware: "auth" });

const { t, locale } = useI18n();
const money = useMoney();
const dateFmt = useDateFormat();

// --- Month navigation -------------------------------------------------------

const now = new Date();
const currentYear = ref(now.getUTCFullYear());
const currentMonth = ref(now.getUTCMonth());

const periodFrom = computed(() => new Date(Date.UTC(currentYear.value, currentMonth.value, 1)));
const periodTo = computed(() => new Date(Date.UTC(currentYear.value, currentMonth.value + 1, 0, 23, 59, 59, 999)));

const monthLabel = computed(() =>
  periodFrom.value.toLocaleDateString(locale.value, { month: "long", year: "numeric" }),
);

const isCurrentMonth = computed(
  () => currentYear.value === now.getUTCFullYear() && currentMonth.value === now.getUTCMonth(),
);

const prevMonth = () => {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value -= 1; }
  else { currentMonth.value -= 1; }
};
const nextMonth = () => {
  if (isCurrentMonth.value) return;
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value += 1; }
  else { currentMonth.value += 1; }
};

const periodVariables = computed(() => ({
  period: { from: periodFrom.value.toISOString(), to: periodTo.value.toISOString() },
}));

const { data } = useQuery({ query: DASHBOARD_QUERY, variables: periodVariables });

// --- Category filter --------------------------------------------------------

const selectedCategoryId = ref("");
const { data: categoriesData } = useQuery({ query: CATEGORIES_QUERY });

const categoryFilterOptions = computed(() => {
  const cats = (categoriesData.value?.categories ?? []) as Array<{ id: string; name: string }>;
  return [
    { value: "", label: t("dashboard.allCategories") },
    ...cats.map((c) => ({ value: c.id, label: c.name })),
  ];
});

const filteredByCategory = computed(() => {
  const items = data.value?.dashboardOverview.expenseByCategory ?? [];
  if (!selectedCategoryId.value) return items;
  return items.filter((item: { category?: { id: string } | null }) =>
    item.category?.id === selectedCategoryId.value);
});

const filteredRecentTransactions = computed(() => {
  const txs = data.value?.dashboardOverview.recentTransactions ?? [];
  if (!selectedCategoryId.value) return txs;
  return txs.filter((tx: { category?: { id: string } | null }) =>
    tx.category?.id === selectedCategoryId.value);
});

const filteredExpense = computed(() => {
  if (!data.value) return { amountMinor: "0", currency: "EUR" };
  if (!selectedCategoryId.value) return data.value.dashboardOverview.expense;
  let total = 0n;
  const currency = data.value.dashboardOverview.expense.currency;
  for (const item of filteredByCategory.value) { total += BigInt(item.total.amountMinor); }
  return { amountMinor: String(total), currency };
});

const filteredIncome = computed(() => {
  if (!data.value) return { amountMinor: "0", currency: "EUR" };
  return data.value.dashboardOverview.income;
});

const filteredNet = computed(() => {
  const inc = BigInt(filteredIncome.value.amountMinor);
  const exp = BigInt(filteredExpense.value.amountMinor);
  return { amountMinor: String(inc - exp), currency: filteredExpense.value.currency };
});

const netClass = computed(() => {
  const n = BigInt(filteredNet.value.amountMinor);
  if (n > 0n) return "kpi--positive";
  if (n < 0n) return "kpi--negative";
  return "";
});

// --- Savings rate -----------------------------------------------------------

const savingsRate = computed(() => {
  const inc = Number(filteredIncome.value.amountMinor);
  if (inc <= 0) return 0;
  const net = Number(filteredNet.value.amountMinor);
  return Math.round((net / inc) * 100);
});

// --- Forecast ---------------------------------------------------------------

const daysInMonth = computed(() => periodTo.value.getUTCDate());
const daysPassed = computed(() => {
  if (!isCurrentMonth.value) return daysInMonth.value;
  return Math.max(1, now.getUTCDate());
});

const avgDailyExpense = computed(() => {
  const exp = Number(filteredExpense.value.amountMinor);
  const daily = Math.round(exp / daysPassed.value);
  return { amountMinor: String(daily), currency: filteredExpense.value.currency };
});

const projectedMonthlyExpense = computed(() => {
  const daily = Number(avgDailyExpense.value.amountMinor);
  const projected = Math.round(daily * daysInMonth.value);
  return { amountMinor: String(projected), currency: filteredExpense.value.currency };
});

const projectedNet = computed(() => {
  const inc = BigInt(filteredIncome.value.amountMinor);
  const projExp = BigInt(projectedMonthlyExpense.value.amountMinor);
  return { amountMinor: String(inc - projExp), currency: filteredExpense.value.currency };
});

const projectedNetNegative = computed(() => BigInt(projectedNet.value.amountMinor) < 0n);

// --- Donut chart ------------------------------------------------------------

const donutCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: ChartJS | null = null;

const CHART_COLORS = [
  "#22d3ee", "#a78bfa", "#e879f9", "#4ade80", "#fbbf24",
  "#f87171", "#38bdf8", "#34d399", "#fb923c", "#c084fc",
];

const buildChart = () => {
  if (!donutCanvas.value || !data.value) return;
  const items = filteredByCategory.value;
  if (items.length === 0) return;

  if (chartInstance) chartInstance.destroy();

  const labels = items.map((i: { category?: { name: string } | null }) => i.category?.name ?? "Other");
  const values = items.map((i: { total: { amountMinor: string } }) => Number(i.total.amountMinor) / 100);
  const colors = items.map(
    (i: { category?: { color: string } | null }, idx: number) =>
      i.category?.color ?? CHART_COLORS[idx % CHART_COLORS.length],
  );

  chartInstance = new ChartJS(donutCanvas.value, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "rgba(8, 13, 26, 0.8)",
        borderWidth: 2,
        hoverBorderColor: "#22d3ee",
        hoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          borderColor: "rgba(6, 182, 212, 0.3)",
          borderWidth: 1,
          titleColor: "#22d3ee",
          bodyColor: "#f1f5f9",
          padding: 12,
          cornerRadius: 8,
        },
      },
    },
  });
};

watch([() => data.value?.dashboardOverview.expenseByCategory, selectedCategoryId], () => {
  nextTick(buildChart);
}, { deep: true });

onMounted(() => nextTick(buildChart));
onUnmounted(() => { if (chartInstance) chartInstance.destroy(); });
</script>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  &__title {
    font-size: var(--fs-3xl);
    font-weight: 800;
    margin: 0;
    background: linear-gradient(135deg, var(--neon) 0%, var(--accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  &__kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-4);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: var(--space-4);
  }

  &__wide {
    grid-column: 1 / -1;
  }
}

// --- KPI cards --------------------------------------------------------------

.kpi {
  @include glass;
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  // Animated gradient border on hover
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, transparent 40%, var(--neon) 50%, transparent 60%);
    background-size: 300% 300%;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 0 24px rgba(6, 182, 212, 0.15);

    &::before {
      opacity: 1;
      animation: border-spin 3s linear infinite;
    }
  }

  &__label {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }

  &__value {
    font-size: var(--fs-2xl);
    font-weight: 800;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  &__hint {
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }

  &--income .kpi__value { color: var(--success); text-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
  &--expense .kpi__value { color: var(--danger); text-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
  &--positive .kpi__value { color: var(--success); text-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
  &--negative .kpi__value { color: var(--danger); text-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
  &--rate .kpi__value { color: var(--neon); text-shadow: 0 0 20px var(--neon-glow); }
}

// --- Month nav / Donut / Legend ---------------------------------------------

.month-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  &__label { min-width: 160px; text-align: center; font-weight: 600; color: var(--neon); text-transform: capitalize; }
}

.donut-wrap { height: 220px; position: relative; margin-bottom: var(--space-4); }

.category-legend {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: var(--space-2);

  li { display: grid; grid-template-columns: 10px 1fr auto 50px; align-items: center; gap: var(--space-3); font-size: var(--fs-sm); }
  &__dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 6px rgba(6, 182, 212, 0.2); }
  &__amount { font-variant-numeric: tabular-nums; font-family: var(--font-mono); font-size: var(--fs-xs); }
  &__pct { text-align: end; color: var(--text-muted); font-size: var(--fs-xs); }
}

// --- Budget progress --------------------------------------------------------

.budget-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.budget-item {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-1);
  }

  &__name {
    font-size: var(--fs-sm);
    font-weight: 600;
  }

  &__amounts {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  &__bar {
    height: 8px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, var(--neon-dim), var(--neon));
    transition: width 0.6s ease;
    box-shadow: 0 0 8px var(--neon-glow);

    &--over {
      background: linear-gradient(90deg, var(--danger), #ff6b6b);
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
    }
  }

  &__remaining {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    margin-top: 2px;
    display: block;

    &--over { color: var(--danger); }
  }
}

// --- Forecast ---------------------------------------------------------------

.forecast {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: var(--space-3);
    background: rgba(6, 182, 212, 0.04);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  &__label {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  &__value {
    font-family: var(--font-mono);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text);

    &--pos { color: var(--success); text-shadow: 0 0 8px rgba(34, 197, 94, 0.2); }
    &--neg { color: var(--danger); text-shadow: 0 0 8px rgba(239, 68, 68, 0.2); }
    &--dim { color: var(--text-muted); }
  }
}

// --- Lists ------------------------------------------------------------------

.renewal-list, .tx-list, .anomaly-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: var(--space-3); font-size: var(--fs-sm);
}

.renewal-list li {
  display: flex; justify-content: space-between; gap: var(--space-3);
  padding: var(--space-2) 0; border-bottom: 1px solid var(--border);
  &:last-child { border-bottom: none; }
  .renewal-list__amount { font-family: var(--font-mono); color: var(--neon); }
  .renewal-list__date { color: var(--text-muted); font-size: var(--fs-xs); }
}

.tx-list li {
  display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-2) 0; border-bottom: 1px solid var(--border);
  &:last-child { border-bottom: none; }
}
.tx-list__left { display: flex; flex-direction: column; }
.tx-list__meta { font-size: var(--fs-xs); color: var(--text-muted); }
.tx-list__amount {
  font-variant-numeric: tabular-nums; font-family: var(--font-mono); font-weight: 600;
  &--neg { color: var(--danger); }
  &--pos { color: var(--success); }
}

.anomaly-list li { padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--fs-sm); }
.anomaly--warning { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.25); color: var(--warning); }
.anomaly--error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); color: var(--danger); }

.empty { color: var(--text-muted); text-align: center; padding: var(--space-4) 0; }

@keyframes border-spin {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
</style>
