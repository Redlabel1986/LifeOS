// ============================================================================
// apps/api — GraphQL request context
// ----------------------------------------------------------------------------
// Attached to every resolver invocation. Carries:
//   * the Prisma client
//   * the authenticated user (if any)
//   * the viewer's locale (derived from user or Accept-Language)
//   * the request logger (child of the root logger, with reqId)
//
// Resolvers call `requireUser(ctx)` rather than checking `ctx.user` directly,
// so every auth-gated field fails with a consistent error.
// ============================================================================

import { prisma, type PrismaClient, type User, Locale } from "@lifeos/db";
import { GraphQLError } from "graphql";
import type { Logger } from "pino";
import { logger as rootLogger } from "./logger.js";
import { verifyAccessToken } from "./auth/tokens.js";

export interface GraphQLContext {
  prisma: PrismaClient;
  user: User | null;
  locale: Locale;
  logger: Logger;
  requestId: string;
}

const SUPPORTED_LOCALES: readonly Locale[] = [
  Locale.de,
  Locale.en,
  Locale.fr,
  Locale.ar,
];

const parseAcceptLanguage = (header: string | null | undefined): Locale | null => {
  if (!header) return null;
  const primary = header.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.find((l) => l === primary) ?? null;
};

const extractBearer = (header: string | null | undefined): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

export interface BuildContextInput {
  authorization?: string | null;
  acceptLanguage?: string | null;
  requestId: string;
}

export const buildContext = async (
  input: BuildContextInput,
): Promise<GraphQLContext> => {
  const log = rootLogger.child({ reqId: input.requestId });

  let user: User | null = null;
  const token = extractBearer(input.authorization);
  if (token) {
    const claims = await verifyAccessToken(token);
    if (claims) {
      user = await prisma.user.findUnique({ where: { id: claims.sub } });
    }
  }

  // Accept-Language from the client takes priority — the user may switch
  // locale in the UI without updating their DB profile.
  const locale =
    parseAcceptLanguage(input.acceptLanguage) ?? user?.locale ?? Locale.de;

  return {
    prisma,
    user,
    locale,
    logger: log,
    requestId: input.requestId,
  };
};

export const requireUser = (ctx: GraphQLContext): User => {
  if (!ctx.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
    });
  }
  return ctx.user;
};
