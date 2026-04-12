<template>
  <div v-if="totalPages > 1" class="ui-pagination">
    <UiButton
      variant="secondary"
      size="sm"
      :disabled="modelValue <= 0"
      @click="$emit('update:modelValue', modelValue - pageSize)"
    >
      {{ t("pagination.prev") }}
    </UiButton>

    <span class="ui-pagination__info">
      {{ currentPage }} / {{ totalPages }}
      <span class="ui-pagination__total">({{ totalCount }})</span>
    </span>

    <UiButton
      variant="secondary"
      size="sm"
      :disabled="!hasMore"
      @click="$emit('update:modelValue', modelValue + pageSize)"
    >
      {{ t("pagination.next") }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  "update:modelValue": [offset: number];
}>();

const { t } = useI18n();

const currentPage = computed(() => Math.floor(props.modelValue / props.pageSize) + 1);
const totalPages = computed(() => Math.ceil(props.totalCount / props.pageSize));
</script>

<style scoped lang="scss">
.ui-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4) 0 0;

  &__info {
    font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }

  &__total {
    font-size: var(--fs-xs);
  }
}
</style>
