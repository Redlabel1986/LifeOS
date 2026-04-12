<template>
  <div class="page">
    <header class="page__header">
      <h1>{{ t("settings.title") }}</h1>
    </header>

    <UiCard :title="t('settings.profile')">
      <form class="settings-form" @submit.prevent="onSaveProfile">
        <UiInput v-model="displayName" :label="t('auth.displayName')" />
        <UiSelect
          v-model="selectedLocale"
          :label="t('settings.language')"
          :options="localeOptions"
        />
        <UiSelect
          v-model="currency"
          :label="t('settings.currency')"
          :options="currencyOptions"
        />
        <UiInput v-model="timezone" :label="t('settings.timezone')" />
        <div class="settings-form__actions">
          <UiButton type="submit" :loading="profileSaving">
            {{ t("common.save") }}
          </UiButton>
          <span v-if="profileSaved" class="settings-form__saved">
            {{ t("settings.saved") }}
          </span>
        </div>
      </form>
    </UiCard>

    <UiCard :title="t('settings.security')">
      <form class="settings-form" @submit.prevent="onChangePassword">
        <UiInput
          v-model="currentPassword"
          :label="t('auth.currentPassword')"
          type="password"
          autocomplete="current-password"
        />
        <UiInput
          v-model="newPassword"
          :label="t('auth.newPassword')"
          type="password"
          autocomplete="new-password"
        />
        <UiButton type="submit">{{ t("settings.changePassword") }}</UiButton>
      </form>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  CHANGE_PASSWORD_MUTATION,
  ME_QUERY,
  UPDATE_PROFILE_MUTATION,
} from "~/graphql/operations";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ middleware: "auth" });

const { t, locales } = useI18n();
const auth = useAuthStore();

const { data } = useQuery({ query: ME_QUERY });

const displayName = ref("");
const selectedLocale = ref("de");
const currency = ref("EUR");
const timezone = ref("Europe/Berlin");

watchEffect(() => {
  if (data.value?.me) {
    displayName.value = data.value.me.displayName ?? "";
    selectedLocale.value = data.value.me.locale;
    currency.value = data.value.me.currency;
    timezone.value = data.value.me.timezone;
  }
});

const localeOptions = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => ({
    value: l.code,
    label: l.name,
  })),
);

const currencyOptions = [
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CHF", label: "CHF — Swiss Franc" },
];

const { execute: updateProfile } = useMutation(UPDATE_PROFILE_MUTATION);
const { execute: changePassword } = useMutation(CHANGE_PASSWORD_MUTATION);

const profileSaving = ref(false);
const profileSaved = ref(false);

const onSaveProfile = async (): Promise<void> => {
  profileSaving.value = true;
  profileSaved.value = false;
  const { data: res } = await updateProfile({
    input: {
      displayName: displayName.value || null,
      locale: selectedLocale.value,
      currency: currency.value,
      timezone: timezone.value,
    },
  });
  if (res?.updateProfile && auth.user) {
    auth.user = { ...auth.user, ...res.updateProfile };
  }
  profileSaving.value = false;
  profileSaved.value = true;
};

const currentPassword = ref("");
const newPassword = ref("");

const onChangePassword = async (): Promise<void> => {
  if (!currentPassword.value || !newPassword.value) return;
  await changePassword({
    input: {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    },
  });
  currentPassword.value = "";
  newPassword.value = "";
};
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 640px;

  &__header h1 {
    font-size: var(--fs-3xl);
    margin: 0;
  }
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

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
</style>
