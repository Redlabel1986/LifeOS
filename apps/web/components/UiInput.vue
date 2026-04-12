<template>
  <label class="ui-input">
    <span v-if="label" class="ui-input__label">{{ label }}</span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :dir="forceLtr ? 'ltr' : undefined"
      @input="onInput"
    />
    <span v-if="hint" class="ui-input__hint">{{ hint }}</span>
    <span v-if="error" class="ui-input__error">{{ error }}</span>
  </label>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string | number | null;
  label?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  autocomplete?: string;
  hint?: string;
  error?: string;
  forceLtr?: boolean;
}

withDefaults(defineProps<Props>(), {
  label: "",
  placeholder: "",
  type: "text",
  required: false,
  disabled: false,
  autocomplete: "off",
  hint: "",
  error: "",
  forceLtr: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const onInput = (e: Event): void => {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
};
</script>

<style scoped lang="scss">
.ui-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--fs-sm);
  color: var(--text);

  &__label {
    font-weight: 500;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  input {
    padding: var(--space-3) var(--space-4);
    background: rgba(15, 23, 42, 0.6);
    color: var(--text);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    font-size: var(--fs-md);
    transition: border-color 0.2s, box-shadow 0.2s;

    &::placeholder {
      color: var(--text-muted);
      opacity: 0.6;
    }

    &:focus {
      outline: none;
      border-color: var(--neon);
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
    }
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  &__hint {
    color: var(--text-muted);
    font-size: var(--fs-xs);
  }

  &__error {
    color: var(--danger);
    font-size: var(--fs-xs);
  }
}
</style>
