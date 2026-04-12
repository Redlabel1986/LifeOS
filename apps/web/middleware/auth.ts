// ============================================================================
// middleware/auth — route guard
// ----------------------------------------------------------------------------
// Attach to any page that requires authentication via
// `definePageMeta({ middleware: 'auth' })`.
// ============================================================================

import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    const localePath = useLocalePath();
    return navigateTo({
      path: localePath("/sign-in"),
      query: { redirect: to.fullPath },
    });
  }
});
