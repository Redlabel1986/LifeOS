// ============================================================================
// Nuxt Server Route — /graphql
// ----------------------------------------------------------------------------
// Embeds the full GraphQL API (graphql-yoga) as a Nuxt server route.
// This means the API runs in the same process as the frontend — one
// deployment, one URL, no CORS issues.
// ============================================================================

import { createYoga } from "graphql-yoga";
import { schema } from "@lifeos/api/schema";
import { buildContext, type GraphQLContext } from "@lifeos/api/context";

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

export default defineEventHandler(async (event) => {
  const { req, res } = event.node;

  // Convert Node IncomingMessage to a Web Request for yoga
  const url = `http://${req.headers.host ?? "localhost"}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  // Read body for POST requests
  let body: string | undefined;
  if (req.method === "POST") {
    body = await new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      req.on("end", () => resolve(data));
    });
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });

  const response = await yoga.fetch(request, { req: request });

  // Send response back through Node
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }
  const text = await response.text();
  res.end(text);
});
