<template>
  <div class="ui-stat">
    <span class="ui-stat__label">{{ label }}</span>
    <span
      :class="['ui-stat__value', tone ? `ui-stat__value--${tone}` : '']"
    >{{ value }}</span>
    <span v-if="hint" class="ui-stat__hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}>();
</script>

<style scoped lang="scss">
.ui-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);

  &__label {
    font-size: var(--fs-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }

  &__value {
    font-size: var(--fs-2xl);
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);

    &--positive {
      color: var(--success);
      text-shadow: 0 0 12px rgba(34, 197, 94, 0.3);
    }
    &--negative {
      color: var(--danger);
      text-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
    }
    &--neutral {
      color: var(--neon);
      text-shadow: 0 0 12px var(--neon-glow);
    }
  }

  &__hint {
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }
}
</style>
