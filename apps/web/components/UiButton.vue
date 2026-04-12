<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['ui-button', `ui-button--${variant}`, `ui-button--${size}`]"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  type: "button",
  variant: "primary",
  size: "md",
  disabled: false,
  loading: false,
});
</script>

<style scoped lang="scss">
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 600;
  line-height: 1;
  transition: all 0.2s ease;
  white-space: nowrap;
  letter-spacing: 0.01em;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  &:focus-visible {
    @include focus-ring;
  }

  &--sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--fs-sm);
  }
  &--md {
    padding: var(--space-3) var(--space-5);
    font-size: var(--fs-sm);
  }
  &--lg {
    padding: var(--space-4) var(--space-6);
    font-size: var(--fs-md);
  }

  &--primary {
    background: linear-gradient(135deg, var(--neon-dim) 0%, var(--neon) 100%);
    color: var(--text-invert);
    border-color: var(--neon);
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
    &:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(6, 182, 212, 0.35);
      transform: translateY(-1px);
    }
  }
  &--secondary {
    background: rgba(6, 182, 212, 0.08);
    border-color: var(--border-strong);
    color: var(--neon);
    &:hover:not(:disabled) {
      background: rgba(6, 182, 212, 0.15);
      border-color: var(--neon);
    }
  }
  &--ghost {
    background: transparent;
    color: var(--text-muted);
    &:hover:not(:disabled) {
      background: rgba(6, 182, 212, 0.08);
      color: var(--neon);
    }
  }
  &--danger {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: var(--danger);
    &:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.25);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
    }
  }

  &__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
