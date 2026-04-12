<template>
  <div class="page">
    <header class="page__header">
      <h1>{{ t("bank.title") }}</h1>
      <div class="page__actions">
        <UiButton
          variant="secondary"
          @click="showCamt = true"
        >
          {{ t("bank.uploadCamt") }}
        </UiButton>
        <UiButton @click="openConnectFlow">
          {{ t("bank.connectLive") }}
        </UiButton>
      </div>
    </header>

    <p class="page__intro">{{ t("bank.intro") }}</p>

    <p
      v-if="bankingConfiguredData && bankingConfiguredData.bankingConfigured === false"
      class="page__warning"
    >
      {{ t("bank.notConfigured") }}
    </p>

    <p v-if="analyzeMessage" class="page__info">{{ analyzeMessage }}</p>

    <div v-if="(connections?.bankConnections ?? []).length" class="conn-grid">
      <UiCard
        v-for="conn in connections?.bankConnections ?? []"
        :key="conn.id"
      >
        <template #header>
          <div>
            <h2 class="conn-card__name">{{ conn.institutionName }}</h2>
            <span :class="['conn-card__status', `conn-card__status--${conn.status}`]">
              {{ t(`bank.status.${conn.status}`) }}
            </span>
          </div>
        </template>

        <ul class="conn-card__accounts">
          <li v-for="acc in conn.accounts" :key="acc.id">
            <span class="conn-card__iban force-ltr">
              {{ acc.iban ?? acc.name ?? "—" }}
            </span>
            <span v-if="acc.balance" class="conn-card__balance">
              {{ money.format(acc.balance) }}
            </span>
            <span class="conn-card__count">
              {{ acc.transactionCount }}
            </span>
          </li>
        </ul>

        <p v-if="conn.lastSyncedAt" class="conn-card__meta">
          {{ t("bank.lastSync") }}: {{ dateFmt.datetime(conn.lastSyncedAt) }}
        </p>
        <p v-if="conn.consentExpiresAt" class="conn-card__meta">
          {{ t("bank.consentExpires") }}: {{ dateFmt.date(conn.consentExpiresAt) }}
        </p>
        <p v-if="conn.errorMessage" class="conn-card__error">
          {{ conn.errorMessage }}
        </p>

        <div class="conn-card__actions">
          <UiButton
            v-if="conn.status === 'PENDING_CONSENT'"
            size="sm"
            @click="onConfirm(conn.id)"
          >
            {{ t("bank.confirmConnection") }}
          </UiButton>
          <UiButton
            v-if="conn.status === 'ACTIVE' && conn.provider === 'GOCARDLESS'"
            variant="secondary"
            size="sm"
            @click="onSync(conn.id)"
          >
            {{ t("bank.syncNow") }}
          </UiButton>
          <UiButton
            v-for="acc in conn.accounts"
            :key="`analyze-${acc.id}`"
            variant="secondary"
            size="sm"
            :loading="analyzingAccountId === acc.id"
            @click="onAnalyze(acc.id, false)"
          >
            {{
              analyzingAccountId === acc.id
                ? t("bank.analyzing")
                : t("bank.analyze")
            }}
          </UiButton>
          <UiButton
            v-for="acc in conn.accounts"
            :key="`force-${acc.id}`"
            variant="ghost"
            size="sm"
            :loading="analyzingAccountId === acc.id"
            :title="t('bank.analyzeForceHint')"
            @click="onAnalyze(acc.id, true)"
          >
            {{ t("bank.analyzeForce") }}
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            @click="onDisconnect(conn.id)"
          >
            {{ t("bank.disconnect") }}
          </UiButton>
        </div>
      </UiCard>
    </div>
    <p v-else class="page__empty">{{ t("bank.noConnections") }}</p>

    <!-- Connect modal: institution picker -->
    <div v-if="showConnect" class="modal" @click.self="showConnect = false">
      <UiCard :title="t('bank.selectBank')" class="modal__body">
        <UiInput
          v-model="institutionSearch"
          :placeholder="t('bank.search')"
        />
        <ul class="institution-list">
          <li
            v-for="inst in filteredInstitutions"
            :key="inst.id"
            @click="onSelectInstitution(inst)"
          >
            <img v-if="inst.logo" :src="inst.logo" :alt="inst.name" />
            <span>{{ inst.name }}</span>
          </li>
        </ul>
        <UiButton variant="secondary" @click="showConnect = false">
          {{ t("common.cancel") }}
        </UiButton>
      </UiCard>
    </div>

    <!-- CAMT upload modal -->
    <div v-if="showCamt" class="modal" @click.self="showCamt = false">
      <UiCard :title="t('bank.uploadCamt')" class="modal__body">
        <p class="modal__hint">{{ t("bank.camtHint") }}</p>
        <label class="camt-drop">
          <input type="file" accept=".xml" @change="onCamtFile" />
          <span>{{ camtLoading ? t("common.loading") : t("documents.dragDrop") }}</span>
        </label>
        <p v-if="camtMessage" :class="['modal__message', camtMessage.includes('Fehler') || camtMessage.includes('failed') || camtMessage.includes('Invalid') ? 'modal__message--error' : '']">
          {{ camtMessage }}
        </p>
        <UiButton variant="secondary" @click="showCamt = false">
          {{ t("common.close") }}
        </UiButton>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  ANALYZE_BANK_ACCOUNT_MUTATION,
  BANKING_CONFIGURED_QUERY,
  BANK_CONNECTIONS_QUERY,
  BANK_INSTITUTIONS_QUERY,
  CONFIRM_BANK_CONNECTION_MUTATION,
  CONNECT_BANK_MUTATION,
  DISCONNECT_BANK_MUTATION,
  IMPORT_CAMT_FILE_MUTATION,
  SYNC_BANK_CONNECTION_MUTATION,
} from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const localePath = useLocalePath();
const money = useMoney();
const dateFmt = useDateFormat();
const route = useRoute();
const router = useRouter();

interface Institution {
  id: string;
  name: string;
  logo: string | null;
  bic: string | null;
}

const { data: bankingConfiguredData } = useQuery({
  query: BANKING_CONFIGURED_QUERY,
});

const { data: connections, execute: refetchConnections } = useQuery({
  query: BANK_CONNECTIONS_QUERY,
});

const showConnect = ref(false);
const showCamt = ref(false);
const institutionSearch = ref("");
const camtMessage = ref("");
const camtLoading = ref(false);

const { data: institutionsData, execute: fetchInstitutions } = useQuery({
  query: BANK_INSTITUTIONS_QUERY,
  variables: { country: "DE" },
  fetchOnMount: false,
});

const filteredInstitutions = computed(() => {
  const list = (institutionsData.value?.bankInstitutions ?? []) as Institution[];
  const q = institutionSearch.value.trim().toLowerCase();
  if (!q) return list.slice(0, 50);
  return list
    .filter((i) => i.name.toLowerCase().includes(q))
    .slice(0, 50);
});

const openConnectFlow = async (): Promise<void> => {
  if (!bankingConfiguredData.value?.bankingConfigured) {
    showCamt.value = true;
    return;
  }
  showConnect.value = true;
  if (!institutionsData.value) {
    await fetchInstitutions();
  }
};

const { execute: connectBank } = useMutation(CONNECT_BANK_MUTATION);
const { execute: confirmConnection } = useMutation(CONFIRM_BANK_CONNECTION_MUTATION);
const { execute: syncConnection } = useMutation(SYNC_BANK_CONNECTION_MUTATION);
const { execute: disconnectBank } = useMutation(DISCONNECT_BANK_MUTATION);
const { execute: importCamt } = useMutation(IMPORT_CAMT_FILE_MUTATION);
const { execute: analyzeAccount } = useMutation(ANALYZE_BANK_ACCOUNT_MUTATION);

const analyzingAccountId = ref<string | null>(null);
const analyzeMessage = ref("");

const onAnalyze = async (
  accountId: string,
  force = false,
): Promise<void> => {
  analyzingAccountId.value = accountId;
  analyzeMessage.value = "";
  try {
    const { error } = await analyzeAccount({ accountId, force });
    if (error) {
      analyzeMessage.value = error.message;
      return;
    }
    analyzeMessage.value = t("bank.analyzeQueued");
  } finally {
    analyzingAccountId.value = null;
  }
};

const onSelectInstitution = async (inst: Institution): Promise<void> => {
  const redirectUrl = `${window.location.origin}${localePath("/bank-accounts")}?confirm=1`;
  const { data, error } = await connectBank({
    input: {
      institutionId: inst.id,
      institutionName: inst.name,
      institutionLogo: inst.logo,
      redirectUrl,
    },
  });
  if (error || !data?.connectBank) return;
  sessionStorage.setItem("lifeos_pending_connection", data.connectBank.connectionId);
  window.location.href = data.connectBank.consentUrl;
};

const onConfirm = async (id: string): Promise<void> => {
  await confirmConnection({ id });
  await refetchConnections();
};

const onSync = async (connectionId: string): Promise<void> => {
  const { data } = await syncConnection({ connectionId });
  if (data?.syncBankConnection) {
    camtMessage.value = t("bank.syncedNew", {
      count: data.syncBankConnection.newTransactions,
    });
  }
  await refetchConnections();
};

const onDisconnect = async (id: string): Promise<void> => {
  await disconnectBank({ id });
  await refetchConnections();
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const onCamtFile = async (e: Event): Promise<void> => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  camtMessage.value = "";
  camtLoading.value = true;
  try {
    const base64 = await fileToBase64(file);
    if (!base64) {
      camtMessage.value = "Fehler: Datei konnte nicht gelesen werden.";
      return;
    }
    const result = await importCamt({
      input: { fileBase64: base64, institutionName: file.name },
    });
    if (result.error) {
      console.error("[CAMT Import]", result.error);
      const msg =
        result.error.message ??
        result.error.graphqlErrors?.[0]?.message ??
        String(result.error);
      camtMessage.value = `Fehler: ${msg}`;
      return;
    }
    if (result.data?.importCamtFile) {
      camtMessage.value = t("bank.syncedNew", {
        count: result.data.importCamtFile.newTransactions,
      });
      await refetchConnections();
    } else {
      camtMessage.value = "Fehler: Keine Antwort vom Server erhalten.";
    }
  } catch (err) {
    console.error("[CAMT Import] uncaught:", err);
    camtMessage.value = `Fehler: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    camtLoading.value = false;
    input.value = "";
  }
};

// Handle the consent callback: GoCardless redirects back to ?confirm=1
onMounted(async () => {
  if (route.query.confirm === "1") {
    const pending = sessionStorage.getItem("lifeos_pending_connection");
    if (pending) {
      await confirmConnection({ id: pending });
      sessionStorage.removeItem("lifeos_pending_connection");
      await refetchConnections();
    }
    await router.replace({ query: {} });
  }
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
    align-items: center;
    gap: var(--space-4);

    h1 {
      font-size: var(--fs-3xl);
      margin: 0;
    }
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
  }

  &__intro {
    color: var(--text-muted);
    margin: 0;
    max-width: 720px;
  }

  &__warning {
    padding: var(--space-3) var(--space-4);
    background: color-mix(in srgb, var(--warning) 15%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--warning) 40%, var(--surface));
    border-radius: var(--radius-md);
    color: var(--text);
    margin: 0;
  }

  &__info {
    padding: var(--space-3) var(--space-4);
    background: color-mix(in srgb, var(--success) 15%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--success) 40%, var(--surface));
    border-radius: var(--radius-md);
    color: var(--text);
    margin: 0;
  }

  &__empty {
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-8) 0;
  }
}

.conn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--space-4);
}

.conn-card {
  &__name {
    margin: 0;
    font-size: var(--fs-lg);
  }

  &__status {
    display: inline-block;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;

    &--ACTIVE {
      background: color-mix(in srgb, var(--success) 15%, var(--surface));
      color: var(--success);
    }
    &--PENDING_CONSENT {
      background: color-mix(in srgb, var(--warning) 15%, var(--surface));
      color: var(--warning);
    }
    &--EXPIRED, &--REVOKED {
      background: var(--surface-alt);
      color: var(--text-muted);
    }
    &--ERROR {
      background: color-mix(in srgb, var(--danger) 15%, var(--surface));
      color: var(--danger);
    }
  }

  &__accounts {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);

    li {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: var(--space-3);
      align-items: center;
      font-size: var(--fs-sm);
    }
  }

  &__iban {
    font-family: ui-monospace, monospace;
    font-size: var(--fs-xs);
  }

  &__balance {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  &__count {
    color: var(--text-muted);
    font-size: var(--fs-xs);
  }

  &__meta {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--fs-xs);
  }

  &__error {
    margin: var(--space-2) 0 0;
    color: var(--danger);
    font-size: var(--fs-xs);
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-4);
    flex-wrap: wrap;
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
    max-width: 520px;
    max-height: 80vh;
    overflow-y: auto;
  }

  &__hint {
    color: var(--text-muted);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-3);
  }

  &__message {
    margin-top: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-alt);
    border-radius: var(--radius-md);
    font-size: var(--fs-sm);

    &--error {
      background: color-mix(in srgb, var(--danger) 15%, var(--surface));
      color: var(--danger);
    }
  }
}

.institution-list {
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 50vh;
  overflow-y: auto;

  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--fs-sm);

    &:hover {
      background: var(--surface-alt);
    }

    img {
      width: 28px;
      height: 28px;
      object-fit: contain;
    }
  }
}

.camt-drop {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-muted);
  margin-bottom: var(--space-3);

  &:hover {
    border-color: var(--brand-500);
    color: var(--brand-600);
  }

  input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
}
</style>
