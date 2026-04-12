<template>
  <section class="ui-card">
    <header v-if="title || $slots.header" class="ui-card__header">
      <slot name="header">
        <h2 class="ui-card__title">{{ title }}</h2>
        <p v-if="subtitle" class="ui-card__subtitle">{{ subtitle }}</p>
      </slot>
      <div v-if="$slots.actions" class="ui-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
}>();
</script>

<style scoped lang="scss">
.ui-card {
  @include glass;
  padding: var(--space-5) var(--space-6);
  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;

  &:hover {
    border-color: rgba(6, 182, 212, 0.25);
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.08), 0 0 40px rgba(6, 182, 212, 0.03);
    transform: translateY(-2px);
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  &__title {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 600;
    color: var(--neon);
  }

  &__subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--fs-sm);
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
  }
}
</style>
