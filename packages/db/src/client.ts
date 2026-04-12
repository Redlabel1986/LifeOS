// ============================================================================
// @lifeos/db — Prisma client factory
// ----------------------------------------------------------------------------
// A single shared instance is kept on `globalThis` in development so that
// hot-reloads don't exhaust the connection pool. In production we instantiate
// fresh — each process gets its own client.
//
// Consumers import `prisma` from '@lifeos/db'. Instantiating PrismaClient
// directly outside this module is forbidden.
// ============================================================================

import { PrismaClient } from "./generated/client/index.js";

type GlobalWithPrisma = typeof globalThis & {
  __lifeosPrisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

const createClient = (): PrismaClient =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

export const prisma: PrismaClient =
  globalForPrisma.__lifeosPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__lifeosPrisma = prisma;
}

export type { PrismaClient };
