// ============================================================================
// apps/api — Pothos schema builder
// ----------------------------------------------------------------------------
// Type-safe, Prisma-aware GraphQL schema builder.
//
// Scalars mirror the SDL in @lifeos/graphql-schema:
//   DateTime → string (ISO 8601)
//   BigInt   → string (money minor units, safe on the wire)
//   Decimal  → string
//   JSON     → unknown (narrowed at the boundary)
//
// Every resolver that touches the DB uses `t.prismaField` (from the Prisma
// plugin) so `select` / `include` are derived from the GraphQL query.
// ============================================================================

import { prisma } from "@lifeos/db";
import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import type PrismaTypes from "@pothos/plugin-prisma/generated";
import { GraphQLError } from "graphql";
import {
  DateTimeResolver,
  BigIntResolver,
  JSONResolver,
} from "graphql-scalars";
import type { GraphQLContext } from "../context.js";

export interface SchemaTypes {
  Context: GraphQLContext;
  PrismaTypes: PrismaTypes;
  Scalars: {
    DateTime: { Input: string; Output: string };
    BigInt: { Input: string; Output: string };
    Decimal: { Input: string; Output: string };
    JSON: { Input: unknown; Output: unknown };
    ID: { Input: string; Output: string };
  };
  AuthScopes: {
    authenticated: boolean;
  };
}

export const builder = new SchemaBuilder<SchemaTypes>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    exposeDescriptions: false,
    filterConnectionTotalCount: true,
    dmmf: undefined,
  },
});

// --- Scalars ----------------------------------------------------------------

builder.addScalarType("DateTime", DateTimeResolver, {});
builder.addScalarType("BigInt", BigIntResolver, {});
builder.addScalarType("JSON", JSONResolver, {});

builder.scalarType("Decimal", {
  serialize: (value) => String(value),
  parseValue: (value) => {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new GraphQLError("Decimal must be a string or number");
    }
    return String(value);
  },
});

// --- Root types -------------------------------------------------------------

builder.queryType({});
builder.mutationType({});
