<template>
  <div class="assistant">
    <header class="assistant__header">
      <h1>{{ t("assistant.title") }}</h1>
    </header>

    <UiCard class="assistant__panel">
      <div class="assistant__messages" ref="scrollEl">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['assistant__bubble', `assistant__bubble--${msg.role}`]"
        >
          {{ msg.content }}
        </div>
        <div v-if="messages.length === 0" class="assistant__empty">
          {{ t("assistant.empty") }}
        </div>
        <div v-if="pending" class="assistant__bubble assistant__bubble--assistant">
          {{ t("assistant.thinking") }}
        </div>
      </div>

      <form class="assistant__composer" @submit.prevent="onSend">
        <input
          v-model="input"
          :placeholder="t('assistant.placeholder')"
          :disabled="pending"
        />
        <UiButton type="submit" :loading="pending" :disabled="!input.trim()">
          {{ t("common.confirm") }}
        </UiButton>
      </form>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from "villus";
import { SEND_AI_MESSAGE_MUTATION } from "~/graphql/operations";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();

interface Msg {
  id: string;
  role: string;
  content: string;
}

const messages = ref<Msg[]>([]);
const input = ref("");
const pending = ref(false);
const conversationId = ref<string | null>(null);
const scrollEl = ref<HTMLElement | null>(null);

const { execute: send } = useMutation(SEND_AI_MESSAGE_MUTATION);

const scrollToBottom = (): void => {
  nextTick(() => {
    if (scrollEl.value) {
      scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
    }
  });
};

const onSend = async (): Promise<void> => {
  const content = input.value.trim();
  if (!content) return;
  messages.value.push({
    id: `local-${Date.now()}`,
    role: "user",
    content,
  });
  input.value = "";
  pending.value = true;
  scrollToBottom();
  try {
    const { data } = await send({
      input: { conversationId: conversationId.value, content },
    });
    if (data?.sendAiMessage) {
      conversationId.value = data.sendAiMessage.conversation.id;
      messages.value = data.sendAiMessage.conversation.messages;
      scrollToBottom();
    }
  } finally {
    pending.value = false;
  }
};
</script>

<style scoped lang="scss">
.assistant {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  height: calc(100vh - #{var(--space-16)});

  &__header h1 {
    font-size: var(--fs-3xl);
    margin: 0;
  }

  &__panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  &__messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-2) 0;
  }

  &__empty {
    text-align: center;
    color: var(--text-muted);
    padding: var(--space-8) 0;
  }

  &__bubble {
    max-width: 70%;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    font-size: var(--fs-sm);
    white-space: pre-wrap;

    &--user {
      background: var(--brand-600);
      color: var(--text-invert);
      align-self: flex-end;
      border-end-end-radius: var(--radius-sm);
    }

    &--assistant {
      background: var(--surface-alt);
      color: var(--text);
      align-self: flex-start;
      border-end-start-radius: var(--radius-sm);
    }
  }

  &__composer {
    display: flex;
    gap: var(--space-2);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);

    input {
      flex: 1;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      font-size: var(--fs-md);
      background: var(--surface);
      color: var(--text);

      &:focus {
        outline: none;
        border-color: var(--brand-500);
        box-shadow: 0 0 0 3px var(--brand-100);
      }
    }
  }
}
</style>
