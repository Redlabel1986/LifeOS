// ============================================================================
// @lifeos/db — embedded Postgres launcher (dev only)
// ----------------------------------------------------------------------------
// Starts a self-contained PostgreSQL binary (via `embedded-postgres`) on
// localhost:5432, creates the `lifeos` database if missing, and blocks.
// Use this when Docker is not available. Not for production.
// ============================================================================

import EmbeddedPostgres from "embedded-postgres";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "..", ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "lifeos",
  password: "lifeos",
  port: 5432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--no-locale"],
});

const main = async (): Promise<void> => {
  console.log(`[embedded-pg] data dir: ${dataDir}`);
  try {
    await pg.initialise();
  } catch {
    // Already initialised — safe to ignore.
  }
  await pg.start();
  try {
    await pg.createDatabase("lifeos");
    console.log("[embedded-pg] created database 'lifeos'");
  } catch {
    // Database already exists.
  }
  console.log("[embedded-pg] ready on postgresql://lifeos:lifeos@localhost:5432/lifeos");
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  console.log(`[embedded-pg] stopping (${signal})`);
  try {
    await pg.stop();
  } catch (err) {
    console.error("[embedded-pg] stop failed", err);
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error("[embedded-pg] failed to start", err);
  process.exit(1);
});
