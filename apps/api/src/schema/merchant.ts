// ============================================================================
// apps/api — Merchant type + queries
// ----------------------------------------------------------------------------
// Merchants are a shared global lookup. Users can search them to attach to
// transactions or subscriptions.
// ============================================================================

import { builder } from "./builder.js";
import { requireUser } from "../context.js";

builder.prismaObject("Merchant", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    displayName: t.exposeString("displayName"),
    website: t.exposeString("website", { nullable: true }),
    logoUrl: t.exposeString("logoUrl", { nullable: true }),
    countryCode: t.exposeString("countryCode", { nullable: true }),
    defaultCategory: t.prismaField({
      type: "Category",
      nullable: true,
      resolve: async (query, parent, _args, ctx) => {
        if (!parent.defaultCategorySlug) return null;
        return ctx.prisma.category.findFirst({
          ...query,
          where: {
            slug: parent.defaultCategorySlug,
            isSystem: true,
          },
        });
      },
    }),
  }),
});

builder.queryField("merchants", (t) =>
  t.prismaField({
    type: ["Merchant"],
    args: {
      search: t.arg.string({ required: false }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: (query, _parent, { search, limit }, ctx) => {
      requireUser(ctx);
      return ctx.prisma.merchant.findMany({
        ...query,
        where: search
          ? {
              OR: [
                { displayName: { contains: search, mode: "insensitive" } },
                { name: { contains: search.toLowerCase() } },
              ],
            }
          : undefined,
        take: Math.min(Math.max(limit ?? 20, 1), 100),
        orderBy: { displayName: "asc" },
      });
    },
  }),
);
