<template>
  <span class="cat-picker" :class="{ 'cat-picker--open': open }">
    <button
      v-if="!open"
      type="button"
      class="cat-picker__trigger"
      :style="{ color: current?.color ?? 'var(--text-muted)' }"
      @click.stop="open = true"
    >
      <span v-if="current">{{ current.name }}</span>
      <span v-else class="cat-picker__empty">—</span>
      <span class="cat-picker__arrow" aria-hidden="true">▾</span>
    </button>
    <select
      v-else
      ref="selectEl"
      class="cat-picker__select"
      :value="modelValue ?? ''"
      @change="onChange"
      @blur="open = false"
    >
      <option value="" disabled>—</option>
      <option
        v-for="opt in options"
        :key="opt.id"
        :value="opt.id"
      >{{ opt.name }}</option>
    </select>
  </span>
</template>

<script setup lang="ts">
interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface Props {
  modelValue: string | null;
  options: Category[];
  current: Category | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

const open = ref(false);
const selectEl = ref<HTMLSelectElement | null>(null);

watch(open, async (next) => {
  if (next) {
    await nextTick();
    selectEl.value?.focus();
  }
});

const onChange = (e: Event): void => {
  const value = (e.target as HTMLSelectElement).value;
  if (!value) return;
  emit("update:modelValue", value);
  emit("change", value);
  open.value = false;
};
</script>

<style scoped lang="scss">
.cat-picker {
  display: inline-block;
  position: relative;

  &__trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    text-align: start;
    line-height: 1.2;

    &:hover {
      background: var(--surface-alt);
      border-color: var(--border);
    }
  }

  &__arrow {
    font-size: 10px;
    opacity: 0.55;
  }

  &__empty {
    color: var(--text-muted);
  }

  &__select {
    padding: 2px 6px;
    font: inherit;
    background: var(--surface);
    border: 1px solid var(--brand-500);
    border-radius: var(--radius-sm);
    color: var(--text);
    outline: none;
    min-width: 140px;

    &:focus {
      box-shadow: 0 0 0 3px var(--brand-100);
    }
  }
}
</style>
