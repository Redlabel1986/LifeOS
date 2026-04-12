<template>
  <div>
    <h1>{{ t("auth.getStarted") }}</h1>
    <form class="sign-up" @submit.prevent="onSubmit">
      <UiInput
        v-model="displayName"
        :label="t('auth.displayName')"
        autocomplete="name"
      />
      <UiInput
        v-model="email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        required
        force-ltr
      />
      <UiInput
        v-model="password"
        :label="t('auth.password')"
        type="password"
        autocomplete="new-password"
        required
        :hint="t('auth.weakPassword')"
      />
      <p v-if="error" class="sign-up__error">{{ error }}</p>
      <UiButton type="submit" :loading="isFetching">
        {{ t("auth.createAccount") }}
      </UiButton>
      <p class="sign-up__alt">
        {{ t("auth.hasAccount") }}
        <NuxtLink :to="localePath('/sign-in')">
          {{ t("auth.signIn") }}
        </NuxtLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from "villus";
import { SIGN_UP_MUTATION } from "~/graphql/operations";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const { t, locale } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const displayName = ref("");
const error = ref("");

const { execute, isFetching } = useMutation(SIGN_UP_MUTATION);

const onSubmit = async (): Promise<void> => {
  error.value = "";
  const { data, error: err } = await execute({
    input: {
      email: email.value,
      password: password.value,
      displayName: displayName.value || null,
      locale: locale.value,
    },
  });
  if (err || !data?.signUp) {
    error.value = err?.message ?? t("common.error");
    return;
  }
  auth.setSession({
    user: data.signUp.user,
    accessToken: data.signUp.accessToken,
    refreshToken: data.signUp.refreshToken,
    expiresAt: data.signUp.expiresAt,
  });
  await router.push(localePath("/"));
};
</script>

<style scoped lang="scss">
.sign-up {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__error {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0;
  }

  &__alt {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
    text-align: center;
  }
}
</style>
