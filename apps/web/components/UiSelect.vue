<template>
  <label class="ui-select">
    <span v-if="label" class="ui-select__label">{{ label }}</span>
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >{{ opt.label }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
interface Option {
  value: string;
  label: string;
}

interface Props {
  modelValue: string | null;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  options: Option[];
}

withDefaults(defineProps<Props>(), {
  label: "",
  placeholder: "",
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const onChange = (e: Event): void => {
  emit("update:modelValue", (e.target as HTMLSelectElement).value);
};
</script>

<style scoped lang="scss">
.ui-select {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--fs-sm);

  &__label {
    font-weight: 500;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  select {
    padding: var(--space-3) var(--space-4);
    background: rgba(15, 23, 42, 0.6);
    color: var(--text);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    font-size: var(--fs-md);
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
      outline: none;
      border-color: var(--neon);
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
    }

    option {
      background: var(--surface-solid);
      color: var(--text);
    }
  }
}
</style>
