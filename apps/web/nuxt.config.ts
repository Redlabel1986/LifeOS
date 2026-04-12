// ============================================================================
// apps/web — Nuxt config
// ----------------------------------------------------------------------------
// Locales: de (default), en, fr, ar (RTL).
// Styling: SCSS only. No Tailwind. Tokens live in assets/scss/_tokens.scss
// and are imported globally via vite.css.preprocessorOptions.
// ============================================================================

export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: true,
  future: { compatibilityVersion: 4 },

  app: {
    pageTransition: { name: "page", mode: "out-in" },
  },

  modules: ["@nuxtjs/i18n", "@pinia/nuxt", "@vueuse/nuxt"],

  typescript: {
    strict: true,
    typeCheck: false,
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.API_PUBLIC_URL ?? "/graphql",
      appName: "LifeOS",
    },
  },

  i18n: {
    strategy: "prefix_except_default",
    defaultLocale: "de",
    lazy: true,
    langDir: "locales",
    locales: [
      { code: "de", iso: "de-DE", name: "Deutsch", file: "de.json", dir: "ltr" },
      { code: "en", iso: "en-US", name: "English", file: "en.json", dir: "ltr" },
      { code: "fr", iso: "fr-FR", name: "Français", file: "fr.json", dir: "ltr" },
      { code: "ar", iso: "ar-SA", name: "العربية", file: "ar.json", dir: "rtl" },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "lifeos_locale",
      alwaysRedirect: false,
      redirectOn: "root",
    },
  },

  app: {
    head: {
      titleTemplate: "%s · LifeOS",
      htmlAttrs: { lang: "de" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
        },
      ],
    },
  },

  css: ["~/assets/scss/main.scss"],

  nitro: {
    // Inline workspace TS packages but keep native/CJS deps external
    externals: {
      inline: [
        "@lifeos/api",
        "@lifeos/ai",
        "@lifeos/config",
        "@lifeos/db",
        "@lifeos/banking",
        "@lifeos/mail",
        "@lifeos/ocr",
        "@lifeos/storage",
        "@lifeos/utils",
        "@lifeos/graphql-schema",
      ],
      external: [
        "pino",
        "pino-pretty",
        "dotenv",
        "@prisma/client",
        "argon2",
        "tesseract.js",
      ],
    },
    // Polyfill __dirname for ESM compatibility
    rollupConfig: {
      output: {
        intro: 'import { fileURLToPath as __fn__ } from "url"; import { dirname as __dn__ } from "path"; const __filename = __fn__(import.meta.url); const __dirname = __dn__(__filename);',
      },
    },
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/tokens" as *;\n',
        },
      },
    },
  },
});
