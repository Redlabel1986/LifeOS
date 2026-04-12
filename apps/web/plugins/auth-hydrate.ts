// ============================================================================
// plugins/auth-hydrate — restore auth state from cookies on every request
// ----------------------------------------------------------------------------
// Runs before villus plugin (alphabetical order: `auth-hydrate.ts` < `villus.ts`)
// so the access token is available when the GraphQL client is created.
// ============================================================================

import { useAuthStore } from "~/stores/auth";

export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  auth.hydrate();
});
