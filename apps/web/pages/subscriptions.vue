<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1>{{ t("subscriptions.title") }}</h1>
        <p v-if="monthlyTotal > 0" class="page__monthly">
          {{ t("subscriptions.monthlyTotal") }}: <strong>{{ formatEur(monthlyTotal) }}</strong>
        </p>
      </div>
      <UiButton @click="showAddModal = true">
        {{ t("subscriptions.new") }}
      </UiButton>
    </header>

    <div v-if="data?.subscriptions.items.length" class="sub-grid">
      <UiCard
        v-for="sub in data.subscriptions.items"
        :key="sub.id"
        class="sub-card"
      >
        <template #header>
          <div>
            <h2 class="sub-card__name">{{ sub.name }}</h2>
            <span
              :class="['sub-card__status', `sub-card__status--${sub.status.toLowerCase()}`]"
            >
              {{ t(`subscriptions.${sub.status.toLowerCase()}`) }}
            </span>
          </div>
        </template>

        <dl class="sub-card__meta">
          <div>
            <dt>{{ t("transactions.amount") }}</dt>
            <dd>
              {{ money.format(sub.money) }} / {{ t(`subscriptions.${sub.billingCycle.toLowerCase()}`) }}
              <span v-if="sub.billingCycle !== 'MONTHLY'" class="sub-card__effective">
                ({{ formatEur(toMonthlyCents(sub)) }} / {{ t("subscriptions.perMonth") }})
              </span>
            </dd>
          </div>
          <div v-if="sub.nextRenewalAt">
            <dt>{{ t("subscriptions.nextRenewal") }}</dt>
            <dd>{{ dateFmt.date(sub.nextRenewalAt) }}</dd>
          </div>
          <div v-if="sub.cancellationDeadline">
            <dt>{{ t("subscriptions.cancellationDeadline") }}</dt>
            <dd>{{ dateFmt.date(sub.cancellationDeadline) }}</dd>
          </div>
        </dl>

        <div v-if="sub.autoDetected" class="sub-card__badge">
          {{ t("subscriptions.autoDetected") }}
        </div>

        <div class="sub-card__actions">
          <UiButton
            variant="secondary"
            size="sm"
            @click="openEdit(sub)"
          >
            {{ t("subscriptions.edit") }}
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            @click="onGenerate(sub.id)"
          >
            {{ t("subscriptions.generateEmail") }}
          </UiButton>
          <UiButton
            v-if="sub.status === 'ACTIVE'"
            variant="danger"
            size="sm"
            @click="onCancel(sub.id)"
          >
            {{ t("subscriptions.cancel") }}
          </UiButton>
        </div>
      </UiCard>
    </div>
    <p v-else class="page__empty">{{ t("subscriptions.empty") }}</p>

    <!-- Edit subscription modal -->
    <div v-if="editing" class="modal" @click.self="editing = null">
      <UiCard :title="t('subscriptions.edit')" class="modal__body">
        <div class="edit-form">
          <UiInput v-model="editing.name" :label="t('subscriptions.name')" />
          <UiInput
            v-model="editing.amount"
            :label="t('transactions.amount')"
            type="number"
            force-ltr
          />
          <UiSelect
            v-model="editing.billingCycle"
            :label="t('subscriptions.cycle')"
            :options="cycleOptions"
          />
          <UiInput
            v-model="editing.nextRenewalAt"
            :label="t('subscriptions.nextRenewal')"
            type="date"
            force-ltr
          />
        </div>
        <p v-if="editError" class="edit-form__error">{{ editError }}</p>
        <p v-if="editSuccess" class="edit-form__success">{{ t("subscriptions.saved") }}</p>
        <div class="modal__actions">
          <UiButton variant="secondary" @click="editing = null">
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton :loading="editSaving" @click="onSaveEdit">
            {{ t("subscriptions.save") }}
          </UiButton>
        </div>
      </UiCard>
    </div>

    <!-- Add subscription modal -->
    <div v-if="showAddModal" class="modal" @click.self="closeAddModal">
      <UiCard :title="t('subscriptions.new')" class="modal__body">
        <div class="add-form">
          <div class="add-form__search">
            <UiInput
              v-model="serviceSearch"
              :label="t('subscriptions.searchService')"
              :placeholder="t('subscriptions.searchPlaceholder')"
              @keydown.enter="fetchPlans"
            />
            <UiButton
              size="sm"
              :loading="loadingPlans"
              :disabled="!serviceSearch.trim()"
              @click="fetchPlans"
            >
              {{ t("subscriptions.lookup") }}
            </UiButton>
          </div>

          <ul v-if="plans.length" class="plan-list">
            <li
              v-for="(plan, idx) in plans"
              :key="idx"
              :class="['plan-list__item', { 'plan-list__item--selected': selectedPlanIdx === idx }]"
              @click="selectPlan(idx)"
            >
              <div class="plan-list__info">
                <strong>{{ plan.serviceName }} — {{ plan.planName }}</strong>
                <span class="plan-list__cycle">{{ plan.billingCycle === 'ANNUAL' ? t('subscriptions.annual') : t('subscriptions.monthly') }}</span>
              </div>
              <span class="plan-list__price">
                {{ formatCents(plan.billingCycle === 'ANNUAL' ? (plan.annualPriceCents ?? plan.monthlyPriceCents * 12) : plan.monthlyPriceCents) }}
                {{ plan.currency }}
                / {{ plan.billingCycle === 'ANNUAL' ? t('subscriptions.perYear') : t('subscriptions.perMonth') }}
              </span>
            </li>
          </ul>

          <p v-if="plansSearched && !plans.length && !loadingPlans" class="add-form__empty">
            {{ t("subscriptions.noPlansFound") }}
          </p>

          <div v-if="selectedPlanIdx !== null" class="add-form__confirm">
            <UiSelect
              v-model="addCycle"
              :label="t('subscriptions.cycle')"
              :options="cycleOptions"
            />
            <UiInput
              v-model="addAmount"
              :label="t('transactions.amount')"
              type="number"
              force-ltr
            />
          </div>
        </div>

        <div class="modal__actions">
          <UiButton variant="secondary" @click="closeAddModal">
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton :disabled="selectedPlanIdx === null" @click="onAddSubscription">
            {{ t("subscriptions.add") }}
          </UiButton>
        </div>
      </UiCard>
    </div>

    <!-- Cancellation email modal -->
    <div v-if="draft" class="modal" @click.self="draft = null">
      <UiCard :title="t('subscriptions.generateEmail')" class="modal__body">
        <UiInput v-model="draft.subject" :label="t('auth.email')" />
        <textarea v-model="draft.body" class="draft__body" rows="12" />
        <div class="modal__actions">
          <UiButton variant="secondary" @click="draft = null">
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton @click="onSend">
            {{ t("subscriptions.sendEmail") }}
          </UiButton>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  CANCEL_SUBSCRIPTION_MUTATION,
  CREATE_SUBSCRIPTION_MUTATION,
  GENERATE_CANCELLATION_EMAIL_MUTATION,
  SEND_CANCELLATION_EMAIL_MUTATION,
  SUBSCRIPTION_PLAN_SUGGESTIONS_QUERY,
  SUBSCRIPTIONS_QUERY,
  UPDATE_SUBSCRIPTION_MUTATION,
} from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const money = useMoney();
const dateFmt = useDateFormat();

const { data, execute: refetch } = useQuery({
  query: SUBSCRIPTIONS_QUERY,
  variables: { page: { limit: 50, offset: 0 } },
  cachePolicy: "network-only",
});

const { execute: cancelSub } = useMutation(CANCEL_SUBSCRIPTION_MUTATION);
const { execute: generate } = useMutation(GENERATE_CANCELLATION_EMAIL_MUTATION);
const { execute: send } = useMutation(SEND_CANCELLATION_EMAIL_MUTATION);
const { execute: createSub } = useMutation(CREATE_SUBSCRIPTION_MUTATION);
const { execute: updateSub } = useMutation(UPDATE_SUBSCRIPTION_MUTATION);

// --- Helpers ---------------------------------------------------------------

const cycleOptions = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-annual" },
  { value: "WEEKLY", label: "Weekly" },
];

const formatCents = (cents: number): string =>
  (cents / 100).toFixed(2).replace(".", ",");

const formatEur = (cents: number): string =>
  `${formatCents(cents)} EUR`;

const toMonthlyCents = (sub: { money: { amountMinor: string }; billingCycle: string }): number => {
  const amount = Number(sub.money.amountMinor);
  switch (sub.billingCycle) {
    case "WEEKLY": return Math.round(amount * 52 / 12);
    case "MONTHLY": return amount;
    case "QUARTERLY": return Math.round(amount / 3);
    case "SEMI_ANNUAL": return Math.round(amount / 6);
    case "ANNUAL": return Math.round(amount / 12);
    default: return amount;
  }
};

const monthlyTotal = computed(() => {
  const items = data.value?.subscriptions.items ?? [];
  return items
    .filter((s: { status: string }) => s.status === "ACTIVE")
    .reduce((sum: number, s: { money: { amountMinor: string }; billingCycle: string }) =>
      sum + toMonthlyCents(s), 0);
});

// --- Cancellation draft ----------------------------------------------------

interface Draft {
  subscriptionId: string;
  subject: string;
  body: string;
}
const draft = ref<Draft | null>(null);

const onCancel = async (id: string): Promise<void> => {
  await cancelSub({ id });
  await refetch();
};

const onGenerate = async (id: string): Promise<void> => {
  const { data: res } = await generate({ id });
  if (res?.generateCancellationEmail) {
    draft.value = {
      subscriptionId: id,
      subject: res.generateCancellationEmail.subject,
      body: res.generateCancellationEmail.body,
    };
  }
};

const onSend = async (): Promise<void> => {
  if (!draft.value) return;
  await send({
    id: draft.value.subscriptionId,
    subject: draft.value.subject,
    body: draft.value.body,
  });
  draft.value = null;
  await refetch();
};

// --- Edit subscription modal -----------------------------------------------

interface EditingState {
  id: string;
  name: string;
  amount: string;
  billingCycle: string;
  nextRenewalAt: string;
  currency: string;
}

const editing = ref<EditingState | null>(null);
const editSaving = ref(false);
const editError = ref("");
const editSuccess = ref(false);

const openEdit = (sub: {
  id: string;
  name: string;
  money: { amountMinor: string; currency: string };
  billingCycle: string;
  nextRenewalAt?: string | null;
}): void => {
  editError.value = "";
  editSuccess.value = false;
  editing.value = {
    id: sub.id,
    name: sub.name,
    amount: (Number(sub.money.amountMinor) / 100).toFixed(2),
    billingCycle: sub.billingCycle,
    nextRenewalAt: sub.nextRenewalAt ? sub.nextRenewalAt.slice(0, 10) : "",
    currency: sub.money.currency,
  };
};

const onSaveEdit = async (): Promise<void> => {
  if (!editing.value) return;
  const amountCents = Math.round(parseFloat(editing.value.amount) * 100);
  if (!amountCents || amountCents <= 0) return;

  editSaving.value = true;
  editError.value = "";
  editSuccess.value = false;

  try {
    const { error } = await updateSub({
      id: editing.value.id,
      input: {
        name: editing.value.name,
        money: { amountMinor: String(amountCents), currency: editing.value.currency },
        billingCycle: editing.value.billingCycle,
        nextRenewalAt: editing.value.nextRenewalAt
        ? new Date(editing.value.nextRenewalAt).toISOString()
        : null,
      },
    });

    if (error) {
      editError.value = error.message;
      return;
    }

    editSuccess.value = true;
    await refetch({ cachePolicy: "network-only" });

    // Close modal after brief feedback
    setTimeout(() => {
      editing.value = null;
      editSuccess.value = false;
    }, 800);
  } finally {
    editSaving.value = false;
  }
};

// --- Add subscription modal ------------------------------------------------

interface Plan {
  serviceName: string;
  planName: string;
  monthlyPriceCents: number;
  currency: string;
  billingCycle: string;
  annualPriceCents?: number;
}

const showAddModal = ref(false);
const serviceSearch = ref("");
const plans = ref<Plan[]>([]);
const loadingPlans = ref(false);
const plansSearched = ref(false);
const selectedPlanIdx = ref<number | null>(null);
const addCycle = ref("MONTHLY");
const addAmount = ref("");

const planSearchVar = ref({ serviceName: "" });
const { data: plansData, execute: executePlanSearch } = useQuery({
  query: SUBSCRIPTION_PLAN_SUGGESTIONS_QUERY,
  variables: planSearchVar,
  fetchOnMount: false,
});

const fetchPlans = async (): Promise<void> => {
  if (!serviceSearch.value.trim()) return;
  loadingPlans.value = true;
  plansSearched.value = false;
  selectedPlanIdx.value = null;
  plans.value = [];
  planSearchVar.value = { serviceName: serviceSearch.value.trim() };
  try {
    await executePlanSearch();
    if (plansData.value?.subscriptionPlanSuggestions) {
      plans.value = plansData.value.subscriptionPlanSuggestions;
    }
  } catch {
    // ignore
  } finally {
    loadingPlans.value = false;
    plansSearched.value = true;
  }
};

const selectPlan = (idx: number): void => {
  selectedPlanIdx.value = idx;
  const plan = plans.value[idx]!;
  addCycle.value = plan.billingCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";
  const cents = plan.billingCycle === "ANNUAL"
    ? (plan.annualPriceCents ?? plan.monthlyPriceCents * 12)
    : plan.monthlyPriceCents;
  addAmount.value = (cents / 100).toFixed(2);
};

const closeAddModal = (): void => {
  showAddModal.value = false;
  serviceSearch.value = "";
  plans.value = [];
  selectedPlanIdx.value = null;
  plansSearched.value = false;
  addAmount.value = "";
  addCycle.value = "MONTHLY";
};

const onAddSubscription = async (): Promise<void> => {
  if (selectedPlanIdx.value === null) return;
  const plan = plans.value[selectedPlanIdx.value]!;
  const amountCents = Math.round(parseFloat(addAmount.value) * 100);
  if (!amountCents || amountCents <= 0) return;

  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await createSub({
    input: {
      name: `${plan.serviceName} — ${plan.planName}`,
      money: { amountMinor: String(amountCents), currency: plan.currency },
      billingCycle: addCycle.value,
      startedAt: now.toISOString(),
      nextRenewalAt: nextMonth.toISOString(),
    },
  });
  closeAddModal();
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
    align-items: flex-end;
    gap: var(--space-4);

    h1 {
      font-size: var(--fs-3xl);
      margin: 0;
    }
  }

  &__monthly {
    margin: var(--space-1) 0 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);

    strong {
      color: var(--text);
      font-size: var(--fs-lg);
    }
  }

  &__empty {
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-8) 0;
  }
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__error {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius-sm);
  }

  &__success {
    color: var(--success);
    font-size: var(--fs-sm);
    font-weight: 600;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: rgba(34, 197, 94, 0.1);
    border-radius: var(--radius-sm);
    text-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
  }
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__search {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
  }

  &__empty {
    color: var(--text-muted);
    font-size: var(--fs-sm);
    text-align: center;
    padding: var(--space-4) 0;
  }

  &__confirm {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
}

.plan-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;

    &:hover {
      border-color: var(--brand-300);
    }

    &--selected {
      border-color: var(--brand-500);
      background: color-mix(in srgb, var(--brand-500) 8%, var(--surface));
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__cycle {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  &__price {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

.sub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.sub-card {
  display: flex;
  flex-direction: column;

  :deep(.ui-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  &__name {
    margin: 0;
    font-size: var(--fs-lg);
    word-break: break-word;
  }

  &__status {
    display: inline-block;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;

    &--active {
      background: color-mix(in srgb, var(--success) 15%, var(--surface));
      color: var(--success);
    }
    &--cancelled {
      background: var(--surface-alt);
      color: var(--text-muted);
    }
  }

  &__meta {
    margin: 0;
    display: grid;
    gap: var(--space-2);
    font-size: var(--fs-sm);

    dt {
      color: var(--text-muted);
      font-size: var(--fs-xs);
      margin: 0;
    }
    dd {
      margin: 0;
      font-weight: 500;
    }
  }

  &__effective {
    color: var(--text-muted);
    font-weight: 400;
    font-size: var(--fs-xs);
  }

  &__badge {
    display: inline-block;
    margin-top: var(--space-3);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--brand-50);
    color: var(--brand-700);
    font-size: var(--fs-xs);
  }

  &__actions {
    margin-top: auto;
    padding-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
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
    max-width: 640px;
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    margin-top: var(--space-3);
  }
}

.draft__body {
  width: 100%;
  font-family: inherit;
  padding: var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  resize: vertical;
  margin-top: var(--space-3);
}
</style>
