<template>
  <div class="auth-layout">
    <div class="auth-layout__panel">
      <div class="auth-layout__brand">
        <span class="auth-layout__mark">◆</span>
        <span class="auth-layout__name">{{ t("app.name") }}</span>
      </div>
      <p class="auth-layout__tagline">{{ t("app.tagline") }}</p>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>

<style scoped lang="scss">
.auth-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--brand-50),
    var(--surface) 60%
  );
  padding: var(--space-6);

  &__panel {
    width: 100%;
    max-width: 420px;
    @include card;
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  &__mark {
    color: var(--brand-600);
    font-size: var(--fs-2xl);
  }

  &__name {
    font-size: var(--fs-2xl);
    font-weight: 700;
  }

  &__tagline {
    color: var(--text-muted);
    margin-bottom: var(--space-4);
  }
}
</style>
