// ============================================================================
// stores/auth — Pinia auth store
// ----------------------------------------------------------------------------
// Persists tokens in cookies so SSR sees them. Exposes user, sign-in,
// sign-out, refresh.
// ============================================================================

import { defineStore } from "pinia";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  locale: "de" | "en" | "fr" | "ar";
  currency: string;
  timezone?: string;
}

interface State {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): State => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
  }),
  getters: {
    isAuthenticated: (s): boolean => Boolean(s.accessToken && s.user),
  },
  actions: {
    hydrate(): void {
      const tokenCookie = useCookie<string | null>("lifeos_access");
      const refreshCookie = useCookie<string | null>("lifeos_refresh");
      const userCookie = useCookie<AuthUser | null>("lifeos_user");
      this.accessToken = tokenCookie.value ?? null;
      this.refreshToken = refreshCookie.value ?? null;
      this.user = userCookie.value ?? null;
    },
    setSession(payload: {
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }): void {
      this.user = payload.user;
      this.accessToken = payload.accessToken;
      this.refreshToken = payload.refreshToken;
      this.expiresAt = payload.expiresAt;

      const opts = {
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      };
      useCookie<string | null>("lifeos_access", opts).value = payload.accessToken;
      useCookie<string | null>("lifeos_refresh", opts).value = payload.refreshToken;
      useCookie<AuthUser | null>("lifeos_user", opts).value = payload.user;
    },
    clear(): void {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
      useCookie<string | null>("lifeos_access").value = null;
      useCookie<string | null>("lifeos_refresh").value = null;
      useCookie<AuthUser | null>("lifeos_user").value = null;
    },
  },
});
