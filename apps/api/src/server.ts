// ============================================================================
// apps/api — server bootstrap
// ----------------------------------------------------------------------------
// Fastify host for graphql-yoga. Responsibilities:
//   * Health check at /health
//   * GraphQL endpoint at /graphql (yoga)
//   * Per-request GraphQLContext built from headers
//   * Graceful shutdown on SIGINT/SIGTERM
//
// Explicitly NOT here: CORS, rate limiting, file upload. Those go in
// dedicated files once the shape of the API is stable.
// ============================================================================

import { randomUUID } from "node:crypto";
import { env } from "@lifeos/config";
import { prisma } from "@lifeos/db";
import Fastify, { type FastifyRequest } from "fastify";
import { createYoga } from "graphql-yoga";
import { buildContext, type GraphQLContext } from "./context.js";
import { logger } from "./logger.js";
import { schema } from "./schema/index.js";

const app = Fastify({
  logger: false,
  disableRequestLogging: true,
  genReqId: () => randomUUID(),
  // CAMT.053 statements + other large GraphQL payloads (base64 file uploads)
  // easily exceed the default 1 MB. 25 MB matches the S3 upload ticket limit.
  bodyLimit: 25 * 1024 * 1024,
});

const yoga = createYoga<{ req: FastifyRequest }>({
  schema,
  logging: {
    debug: (...args) => logger.debug({ args }, "yoga debug"),
    info: (...args) => logger.info({ args }, "yoga info"),
    warn: (...args) => logger.warn({ args }, "yoga warn"),
    error: (...args) => logger.error({ args }, "yoga error"),
  },
  graphiql: env.NODE_ENV !== "production",
  context: async ({ req }): Promise<GraphQLContext> =>
    buildContext({
      authorization: req.headers.authorization ?? null,
      acceptLanguage: req.headers["accept-language"] ?? null,
      requestId: req.id,
    }),
  maskedErrors: env.NODE_ENV === "production",
});

app.route({
  url: "/graphql",
  method: ["GET", "POST", "OPTIONS"],
  handler: async (req, reply) => {
    const response = await yoga.handleNodeRequestAndResponse(req, reply, {
      req,
    });
    for (const [key, value] of response.headers.entries()) {
      reply.header(key, value);
    }
    reply.status(response.status);
    reply.send(response.body);
    return reply;
  },
});

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok", service: "api", ts: new Date().toISOString() };
});

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ signal }, "shutting down");
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Safety net: background jobs (OCR, AI extraction) may throw from worker
// threads or native bindings in ways Node can't catch via the await chain.
// Log and keep the API alive instead of letting a single document crash it.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — keeping process alive");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection — keeping process alive");
});

const start = async (): Promise<void> => {
  try {
    const address = await app.listen({ host: env.API_HOST, port: env.API_PORT });
    logger.info({ address }, "lifeos api listening");
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
};

void start();
