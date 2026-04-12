// ============================================================================
// plugins/villus — GraphQL client
// ----------------------------------------------------------------------------
// Attaches the bearer token from the auth store to every request.
// On 401 / UNAUTHENTICATED, transparently refreshes the access token using
// the stored refresh token and retries the operation once. If refresh also
// fails, clears the session and lets the UI route back to sign-in.
// ============================================================================

import { createClient, defaultPlugins } from "villus";
import type { ClientPlugin, ClientPluginContext } from "villus";
import { useAuthStore } from "~/stores/auth";

const REFRESH_MUTATION = /* GraphQL */ `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      expiresAt
      user {
        id
        email
        displayName
        locale
        currency
        timezone
      }
    }
  }
`;

interface RefreshResponse {
  data?: {
    refreshToken?: {
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
      user: {
        id: string;
        email: string;
        displayName: string | null;
        locale: "de" | "en" | "fr" | "ar";
        currency: string;
        timezone: string;
      };
    };
  };
  errors?: unknown[];
}

const doRefresh = async (apiUrl: string, refreshToken: string) => {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: REFRESH_MUTATION,
      variables: { refreshToken },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as RefreshResponse;
  return json.data?.refreshToken ?? null;
};

let currentLocale = "de";

const authPlugin: ClientPlugin = ({ opContext }) => {
  const auth = useAuthStore();
  const headers: Record<string, string> = {
    ...opContext.headers as Record<string, string>,
    "Accept-Language": currentLocale,
  };
  if (auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  opContext.headers = headers;
};

const isUnauthenticated = (result: {
  data: unknown;
  error: unknown;
}): boolean => {
  const err = result.error as
    | { graphqlErrors?: Array<{ extensions?: { code?: string } }> }
    | null
    | undefined;
  if (!err?.graphqlErrors) return false;
  return err.graphqlErrors.some(
    (e) => e.extensions?.code === "UNAUTHENTICATED",
  );
};

const buildAuthRefreshPlugin = (apiUrl: string): ClientPlugin => {
  let refreshing: Promise<boolean> | null = null;

  return async ({ afterQuery, useResult, operation }: ClientPluginContext) => {
    afterQuery(async (result) => {
      if (!isUnauthenticated(result)) return;
      const auth = useAuthStore();
      if (!auth.refreshToken) {
        auth.clear();
        return;
      }

      // Coalesce parallel refresh attempts into one.
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const fresh = await doRefresh(apiUrl, auth.refreshToken!);
            if (!fresh) {
              auth.clear();
              return false;
            }
            auth.setSession({
              user: fresh.user,
              accessToken: fresh.accessToken,
              refreshToken: fresh.refreshToken,
              expiresAt: fresh.expiresAt,
            });
            return true;
          } catch {
            auth.clear();
            return false;
          } finally {
            refreshing = null;
          }
        })();
      }
      const ok = await refreshing;
      if (!ok) return;

      // Retry the original operation once with the fresh token.
      try {
        const retryRes = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            query: operation.query,
            variables: operation.variables ?? {},
          }),
        });
        if (!retryRes.ok) return;
        const body = (await retryRes.json()) as {
          data?: unknown;
          errors?: unknown[];
        };
        useResult(
          {
            data: body.data ?? null,
            error: body.errors?.length
              ? ({ graphqlErrors: body.errors } as unknown as Error)
              : null,
          },
          true,
        );
      } catch {
        // Give up silently — the original 401 result stands.
      }
    });
  };
};

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl;

  // Track locale changes for Accept-Language header
  const i18n = nuxtApp.$i18n as { locale: { value: string } };
  if (i18n?.locale) {
    currentLocale = i18n.locale.value;
    watch(() => i18n.locale.value, (v) => { currentLocale = v; });
  }

  const client = createClient({
    url: apiUrl,
    cachePolicy: "cache-and-network",
    use: [authPlugin, buildAuthRefreshPlugin(apiUrl), ...defaultPlugins()],
  });
  nuxtApp.vueApp.use(client);
});
