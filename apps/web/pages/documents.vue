<template>
  <div class="page">
    <header class="page__header">
      <h1>{{ t("documents.title") }}</h1>
      <div class="page__actions">
        <UiSelect
          v-model="uploadType"
          :label="t('documents.selectType')"
          :options="typeOptions"
        />
        <label class="upload-btn">
          <input type="file" accept="image/*,application/pdf" @change="onFile" />
          <span>{{ t("documents.upload") }}</span>
        </label>
      </div>
    </header>

    <p v-if="uploading" class="page__hint">{{ t("documents.processing") }}</p>

    <div v-if="data?.documents.items.length" class="doc-grid">
      <UiCard
        v-for="doc in data.documents.items"
        :key="doc.id"
      >
        <template #header>
          <div>
            <h2 class="doc-card__title">{{ doc.originalName ?? doc.id }}</h2>
            <span class="doc-card__status">
              {{ t(`documents.${doc.status.toLowerCase()}`) }}
            </span>
          </div>
        </template>

        <dl class="doc-card__meta">
          <div>
            <dt>{{ t("documents.type") }}</dt>
            <dd>{{ t(`documents.${doc.type.toLowerCase()}`) }}</dd>
          </div>
          <div v-if="doc.language">
            <dt>lang</dt>
            <dd>{{ doc.language }}</dd>
          </div>
        </dl>

        <p v-if="doc.summary" class="doc-card__summary">{{ doc.summary }}</p>

        <ul v-if="doc.aiTags.length" class="doc-card__tags">
          <li v-for="tag in doc.aiTags" :key="tag">{{ tag }}</li>
        </ul>

        <div class="doc-card__actions">
          <UiButton variant="ghost" size="sm" @click="onDelete(doc.id)">
            {{ t("common.delete") }}
          </UiButton>
        </div>
      </UiCard>
    </div>
    <p v-else class="page__empty">{{ t("documents.empty") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from "villus";
import {
  DELETE_DOCUMENT_MUTATION,
  DOCUMENTS_QUERY,
  UPLOAD_DOCUMENT_MUTATION,
} from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const uploading = ref(false);
const uploadType = ref("RECEIPT");

const typeOptions = computed(() => [
  { value: "RECEIPT", label: t("documents.receipt") },
  { value: "INVOICE", label: t("documents.invoice") },
  { value: "CONTRACT", label: t("documents.contract") },
  { value: "LETTER", label: t("documents.letter") },
  { value: "PAYSLIP", label: t("documents.payslip") },
  { value: "TAX_DOCUMENT", label: t("documents.taxDocument") },
  { value: "OTHER", label: t("documents.other") },
]);

const { data, execute: refetch } = useQuery({
  query: DOCUMENTS_QUERY,
  variables: { page: { limit: 30, offset: 0 } },
});

const { execute: uploadDoc } = useMutation(UPLOAD_DOCUMENT_MUTATION);
const { execute: deleteDoc } = useMutation(DELETE_DOCUMENT_MUTATION);

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const onFile = async (e: Event): Promise<void> => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const fileBase64 = await fileToBase64(file);
    const { error } = await uploadDoc({
      input: {
        type: uploadType.value,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
        fileBase64,
      },
    });
    if (error) {
      console.error("upload failed", error);
      return;
    }
    // Processing runs in the background. Refetch shortly so the user sees
    // the row, then again after a few seconds to pick up the PROCESSED state.
    await refetch();
    setTimeout(() => {
      void refetch();
    }, 5000);
  } finally {
    uploading.value = false;
    input.value = "";
  }
};

const onDelete = async (id: string): Promise<void> => {
  await deleteDoc({ id });
  await refetch();
};
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-4);
    flex-wrap: wrap;

    h1 {
      font-size: var(--fs-3xl);
      margin: 0;
    }
  }

  &__actions {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
  }

  &__empty,
  &__hint {
    color: var(--text-muted);
  }

  &__empty {
    text-align: center;
    padding: var(--space-8) 0;
  }
}

.upload-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--brand-600);
  color: var(--text-invert);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--fs-md);
  font-weight: 500;

  &:hover {
    background: var(--brand-700);
  }

  input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
}

.doc-card {
  &__title {
    margin: 0;
    font-size: var(--fs-md);
    @include text-truncate;
  }

  &__status {
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }

  &__meta {
    margin: 0;
    display: flex;
    gap: var(--space-4);
    font-size: var(--fs-sm);

    dt {
      color: var(--text-muted);
      font-size: var(--fs-xs);
      margin: 0;
    }
    dd {
      margin: 0;
    }
  }

  &__summary {
    margin-top: var(--space-3);
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  &__tags {
    list-style: none;
    padding: 0;
    margin: var(--space-2) 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);

    li {
      padding: 2px var(--space-2);
      background: var(--surface-alt);
      border-radius: var(--radius-pill);
      font-size: var(--fs-xs);
      color: var(--text-muted);
    }
  }

  &__actions {
    margin-top: var(--space-3);
    display: flex;
    justify-content: flex-end;
  }
}
</style>
