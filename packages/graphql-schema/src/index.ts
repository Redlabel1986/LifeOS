// ============================================================================
// @lifeos/graphql-schema — entry
// ----------------------------------------------------------------------------
// Exposes:
//   * `typeDefs`   — the SDL as a string, ready to hand to a GraphQL server
//   * `schemaPath` — absolute path to schema.graphql (for tooling)
//   * all generated TS types from the SDL
//
// The generated types file is produced by `pnpm --filter @lifeos/graphql-schema codegen`.
// It is intentionally committed-ignored; CI must run codegen before typecheck.
// ============================================================================

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the canonical SDL file. */
export const schemaPath: string = join(here, "..", "schema.graphql");

/** The SDL as a UTF-8 string, ready for `makeExecutableSchema` / Pothos / Yoga. */
export const typeDefs: string = readFileSync(schemaPath, "utf8");

export type * from "./generated/types.js";
