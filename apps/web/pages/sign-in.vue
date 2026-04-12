<template>
  <div>
    <h1>{{ t("auth.welcomeBack") }}</h1>
    <form class="sign-in" @submit.prevent="onSubmit">
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
        autocomplete="current-password"
        required
      />
      <p v-if="error" class="sign-in__error">{{ error }}</p>
      <UiButton type="submit" :loading="isFetching">
        {{ t("auth.signIn") }}
      </UiButton>
      <p class="sign-in__alt">
        {{ t("auth.noAccount") }}
        <NuxtLink :to="localePath('/sign-up')">
          {{ t("auth.createAccount") }}
        </NuxtLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from "villus";
import { SIGN_IN_MUTATION } from "~/graphql/operations";
import { useAuthStore } from "~/stores/auth";

definePageMeta({ layout: "auth" });

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const error = ref("");

const { execute, isFetching } = useMutation(SIGN_IN_MUTATION);

const onSubmit = async (): Promise<void> => {
  error.value = "";
  const { data, error: err } = await execute({
    input: { email: email.value, password: password.value },
  });
  if (err || !data?.signIn) {
    error.value = t("auth.invalidCredentials");
    return;
  }
  auth.setSession({
    user: data.signIn.user,
    accessToken: data.signIn.accessToken,
    refreshToken: data.signIn.refreshToken,
    expiresAt: data.signIn.expiresAt,
  });
  const redirect = (route.query.redirect as string | undefined) ?? localePath("/");
  await router.push(redirect);
};
</script>

<style scoped lang="scss">
.sign-in {
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
