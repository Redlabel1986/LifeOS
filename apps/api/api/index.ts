// ============================================================================
// Vercel Serverless Function — wraps graphql-yoga for Vercel
// ============================================================================

import { createYoga } from "graphql-yoga";
import { buildContext, type GraphQLContext } from "../src/context.js";
import { schema } from "../src/schema/index.js";

const yoga = createYoga<{ req: Request }>({
  schema,
  graphiql: process.env.NODE_ENV !== "production",
  context: async ({ req }): Promise<GraphQLContext> =>
    buildContext({
      authorization: req.headers.get("authorization") ?? null,
      acceptLanguage: req.headers.get("accept-language") ?? null,
      requestId: crypto.randomUUID(),
    }),
  maskedErrors: process.env.NODE_ENV === "production",
});

export default async function handler(req: Request): Promise<Response> {
  return yoga.fetch(req);
}

export const config = {
  api: { bodyParser: false },
};
