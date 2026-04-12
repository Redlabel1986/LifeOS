// ============================================================================
// @lifeos/config — Zod-validated environment
// ----------------------------------------------------------------------------
// Single source of truth for runtime configuration.
//
// Rules:
//   * Every env var must be declared in the schema below, with a default or
//     an explicit `required()`.
//   * Accessing `process.env` directly outside this module is forbidden.
//   * Validation runs once at import time; misconfiguration crashes the
//     service immediately with a readable error instead of failing later.
// ============================================================================

import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : v === "true" || v === "1"));

const EnvSchema = z.object({
  // --- Runtime -------------------------------------------------------------
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // --- Services ------------------------------------------------------------
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  WEB_PUBLIC_URL: z.string().url().default("http://localhost:3000"),

  // --- Database ------------------------------------------------------------
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // --- Redis / Queue -------------------------------------------------------
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // --- Object storage (S3-compatible) --------------------------------------
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("eu-central-1"),
  S3_BUCKET: z.string().default("lifeos-documents"),
  S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),

  // --- Auth ----------------------------------------------------------------
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30), // 30 days

  // --- Crypto --------------------------------------------------------------
  CRYPTO_MASTER_KEY: z
    .string()
    .min(32, "CRYPTO_MASTER_KEY must be at least 32 chars"),

  // --- AI / OCR providers --------------------------------------------------
  // Anthropic preferred when both keys are present.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-6"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OCR_PROVIDER: z
    .enum(["tesseract", "textract", "google-vision"])
    .default("tesseract"),

  // --- Banking (GoCardless Bank Account Data) ------------------------------
  GOCARDLESS_SECRET_ID: z.string().optional(),
  GOCARDLESS_SECRET_KEY: z.string().optional(),

  // --- Mail ----------------------------------------------------------------
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("LifeOS <no-reply@lifeos.local>"),

  // --- Feature flags -------------------------------------------------------
  FEATURE_BANK_IMPORT: booleanFromString.default(false),
  FEATURE_EMAIL_PARSING: booleanFromString.default(false),
});

export type Env = z.infer<typeof EnvSchema>;

const parseEnv = (): Env => {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[@lifeos/config] Invalid environment configuration:\n${issues}`,
    );
  }
  return result.data;
};

export const env: Env = parseEnv();

export const isProduction = (): boolean => env.NODE_ENV === "production";
export const isDevelopment = (): boolean => env.NODE_ENV === "development";
export const isTest = (): boolean => env.NODE_ENV === "test";
