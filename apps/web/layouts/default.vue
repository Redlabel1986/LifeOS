<template>
  <div class="layout" :class="{ 'layout--open': sidebarOpen }">
    <!-- Mobile top bar -->
    <header class="layout__topbar">
      <button class="layout__burger" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">
        <span /><span /><span />
      </button>
      <span class="layout__topbar-brand">&#9670; LifeOS</span>
    </header>

    <!-- Overlay -->
    <div v-if="sidebarOpen" class="layout__overlay" @click="sidebarOpen = false" />

    <aside class="layout__sidebar">
      <div class="layout__brand">
        <span class="layout__brand-mark">&#9670;</span>
        <span class="layout__brand-name">LifeOS</span>
      </div>

      <!-- Search -->
      <div class="layout__search">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('nav.search')"
          class="layout__search-input"
          @keydown.enter="onSearch"
        />
      </div>

      <nav class="layout__nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="localePath(item.to)"
          class="layout__nav-item"
          :activeClass="'layout__nav-item--active'"
          @click="sidebarOpen = false"
        >
          <span class="layout__nav-icon">{{ item.icon }}</span>
          <span>{{ t(item.labelKey) }}</span>
        </NuxtLink>
      </nav>
      <div class="layout__sidebar-footer">
        <UiSelect
          v-model="currentLocale"
          :options="localeOptions"
          @update:model-value="onLocaleChange"
        />
        <UiButton variant="ghost" size="sm" @click="onSignOut">
          {{ t("nav.signOut") }}
        </UiButton>
      </div>
    </aside>
    <main class="layout__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from "villus";
import { SIGN_OUT_MUTATION } from "~/graphql/operations";
import { useAuthStore } from "~/stores/auth";

const { t, locale, locales, setLocale } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();
const router = useRouter();

const sidebarOpen = ref(false);
const searchQuery = ref("");

const onSearch = () => {
  if (!searchQuery.value.trim()) return;
  router.push(localePath(`/transactions?q=${encodeURIComponent(searchQuery.value.trim())}`));
  sidebarOpen.value = false;
  searchQuery.value = "";
};

const navItems = [
  { to: "/", labelKey: "nav.dashboard", icon: "\u25C8" },
  { to: "/transactions", labelKey: "nav.transactions", icon: "\u2194" },
  { to: "/subscriptions", labelKey: "nav.subscriptions", icon: "\u221E" },
  { to: "/documents", labelKey: "nav.documents", icon: "\u25A4" },
  { to: "/budgets", labelKey: "nav.budgets", icon: "\u25CE" },
  { to: "/tax", labelKey: "nav.tax", icon: "\u2261" },
  { to: "/bank-accounts", labelKey: "nav.bankAccounts", icon: "\u2302" },
  { to: "/assistant", labelKey: "nav.assistant", icon: "\u2726" },
  { to: "/settings", labelKey: "nav.settings", icon: "\u2699" },
];

const currentLocale = ref(locale.value as string);
const localeOptions = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => ({
    value: l.code,
    label: l.name,
  })),
);

const onLocaleChange = async (next: string): Promise<void> => {
  await setLocale(next as "de" | "en" | "fr" | "ar");
};

const { execute: signOut } = useMutation(SIGN_OUT_MUTATION);

const onSignOut = async (): Promise<void> => {
  await signOut({});
  auth.clear();
  await router.push(localePath("/sign-in"));
};
</script>

<style scoped lang="scss">
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;

  &__topbar {
    display: none;
  }

  &__overlay {
    display: none;
  }

  &__sidebar {
    background: rgba(8, 13, 26, 0.92);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-3);
    gap: var(--space-4);
    backdrop-filter: blur(20px);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    display: block;

    &__topbar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: rgba(8, 13, 26, 0.95);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(20px);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    // MUST come after the base &__sidebar to override position/height
    &__sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
    }

    &--open &__sidebar {
      transform: translateX(0);
    }

    &__overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 150;
    }

    &__main {
      padding: var(--space-4);
    }
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
  }

  &__brand-mark {
    color: var(--neon);
    font-size: var(--fs-2xl);
    text-shadow: 0 0 12px var(--neon-glow);
    animation: pulse-glow 3s ease-in-out infinite;
  }

  &__brand-name {
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, var(--neon) 0%, var(--accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__search {
    padding: 0 var(--space-2);
  }

  &__search-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: rgba(6, 182, 212, 0.06);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: var(--fs-sm);
    transition: border-color 0.2s, box-shadow 0.2s;

    &::placeholder {
      color: var(--text-muted);
      opacity: 0.5;
    }

    &:focus {
      outline: none;
      border-color: var(--neon);
      box-shadow: 0 0 12px rgba(6, 182, 212, 0.15);
    }
  }

  &__nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  &__nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--fs-sm);
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(6, 182, 212, 0.08);
      color: var(--text);
      text-decoration: none;
    }

    &--active {
      background: rgba(6, 182, 212, 0.12);
      color: var(--neon);
      box-shadow: inset 3px 0 0 var(--neon);

      .layout__nav-icon {
        text-shadow: 0 0 8px var(--neon-glow);
      }
    }
  }

  &__nav-icon {
    font-size: var(--fs-md);
    width: 20px;
    text-align: center;
  }

  &__sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }

  &__main {
    padding: var(--space-8);
    min-width: 0;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  &__burger {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: none;
    border: none;
    padding: var(--space-2);
    cursor: pointer;

    span {
      display: block;
      width: 20px;
      height: 2px;
      background: var(--neon);
      border-radius: 1px;
      transition: transform 0.2s;
    }
  }

  &__topbar-brand {
    font-weight: 700;
    font-size: var(--fs-lg);
    color: var(--neon);
  }
}

@keyframes pulse-glow {
  0%, 100% { text-shadow: 0 0 12px var(--neon-glow); }
  50% { text-shadow: 0 0 20px var(--neon-glow), 0 0 40px rgba(6, 182, 212, 0.15); }
}

// RTL: only text direction changes, layout stays LTR
[dir="rtl"] .layout {
  direction: ltr;

  .layout__nav-item,
  .layout__brand,
  .layout__sidebar-footer,
  .layout__search-input {
    direction: rtl;
    text-align: right;
  }

  .layout__main {
    direction: rtl;
  }
}
</style>
