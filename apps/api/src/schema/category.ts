// ============================================================================
// apps/api — Category type + CRUD
// ----------------------------------------------------------------------------
// Showcase of the i18n pattern: `name(locale)` picks from `translations` JSON,
// defaulting to the viewer's locale from context. System categories
// (userId=null, isSystem=true) are visible to every authenticated user.
// ============================================================================

import { CategoryKind, Locale, Prisma } from "@lifeos/db";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";

const FALLBACK_LOCALE: Locale = Locale.en;

const pickTranslation = (
  raw: Prisma.JsonValue,
  preferred: Locale,
): string => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const map = raw as Record<string, unknown>;
    const primary = map[preferred];
    if (typeof primary === "string" && primary.length > 0) return primary;
    const fallback = map[FALLBACK_LOCALE];
    if (typeof fallback === "string" && fallback.length > 0) return fallback;
    const firstString = Object.values(map).find(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (firstString) return firstString;
  }
  return "";
};

builder.prismaObject("Category", {
  fields: (t) => ({
    id: t.exposeID("id"),
    kind: t.field({ type: CategoryKind, resolve: (c) => c.kind }),
    slug: t.exposeString("slug"),
    name: t.string({
      args: { locale: t.arg({ type: Locale, required: false }) },
      resolve: (parent, { locale }, ctx) =>
        pickTranslation(parent.translations, locale ?? ctx.locale),
    }),
    translations: t.field({
      type: "JSON",
      resolve: (c) => c.translations as unknown,
    }),
    icon: t.exposeString("icon", { nullable: true }),
    color: t.exposeString("color", { nullable: true }),
    taxDeductible: t.exposeBoolean("taxDeductible"),
    taxCode: t.exposeString("taxCode", { nullable: true }),
    isSystem: t.exposeBoolean("isSystem"),
    parent: t.relation("parent", { nullable: true }),
    children: t.relation("children"),
  }),
});

// --- Inputs -----------------------------------------------------------------

const CreateCategoryInput = builder.inputType("CreateCategoryInput", {
  fields: (t) => ({
    kind: t.field({ type: CategoryKind, required: true }),
    slug: t.string({ required: true }),
    translations: t.field({ type: "JSON", required: true }),
    parentId: t.id({ required: false }),
    icon: t.string({ required: false }),
    color: t.string({ required: false }),
    taxDeductible: t.boolean({ required: false }),
    taxCode: t.string({ required: false }),
  }),
});

const UpdateCategoryInput = builder.inputType("UpdateCategoryInput", {
  fields: (t) => ({
    slug: t.string({ required: false }),
    translations: t.field({ type: "JSON", required: false }),
    parentId: t.id({ required: false }),
    icon: t.string({ required: false }),
    color: t.string({ required: false }),
    taxDeductible: t.boolean({ required: false }),
    taxCode: t.string({ required: false }),
  }),
});

interface CategoryPayloadShape {
  categoryId: string;
}

const CategoryPayloadRef = builder
  .objectRef<CategoryPayloadShape>("CategoryPayload")
  .implement({
    fields: (t) => ({
      category: t.prismaField({
        type: "Category",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.category.findUniqueOrThrow({
            ...query,
            where: { id: parent.categoryId },
          }),
      }),
    }),
  });

const assertTranslationsShape = (value: unknown): void => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GraphQLError("translations must be an object keyed by locale", {
      extensions: { code: "INVALID_TRANSLATIONS" },
    });
  }
  const map = value as Record<string, unknown>;
  const required: Locale[] = [Locale.de, Locale.en];
  for (const locale of required) {
    const v = map[locale];
    if (typeof v !== "string" || v.length === 0) {
      throw new GraphQLError(
        `translations.${locale} is required and must be a non-empty string`,
        { extensions: { code: "INVALID_TRANSLATIONS" } },
      );
    }
  }
};

// --- Queries ----------------------------------------------------------------

builder.queryField("categories", (t) =>
  t.prismaField({
    type: ["Category"],
    args: {
      kind: t.arg({ type: CategoryKind, required: false }),
    },
    resolve: (query, _parent, { kind }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.category.findMany({
        ...query,
        where: {
          AND: [
            { OR: [{ userId: user.id }, { isSystem: true }] },
            kind ? { kind } : {},
          ],
        },
        orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }, { slug: "asc" }],
      });
    },
  }),
);

builder.queryField("category", (t) =>
  t.prismaField({
    type: "Category",
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _parent, { id }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.category.findFirst({
        ...query,
        where: {
          id,
          OR: [{ userId: user.id }, { isSystem: true }],
        },
      });
    },
  }),
);

// --- Mutations --------------------------------------------------------------

builder.mutationField("createCategory", (t) =>
  t.field({
    type: CategoryPayloadRef,
    args: { input: t.arg({ type: CreateCategoryInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      assertTranslationsShape(input.translations);
      const created = await ctx.prisma.category.create({
        data: {
          userId: user.id,
          kind: input.kind,
          slug: input.slug,
          translations: input.translations as Prisma.InputJsonValue,
          parentId: input.parentId ?? null,
          icon: input.icon ?? null,
          color: input.color ?? null,
          taxDeductible: input.taxDeductible ?? false,
          taxCode: input.taxCode ?? null,
        },
      });
      return { categoryId: created.id };
    },
  }),
);

builder.mutationField("updateCategory", (t) =>
  t.field({
    type: CategoryPayloadRef,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateCategoryInput, required: true }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      const user = requireUser(ctx);
      if (input.translations !== undefined && input.translations !== null) {
        assertTranslationsShape(input.translations);
      }
      const existing = await ctx.prisma.category.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) {
        throw new GraphQLError("Category not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const updated = await ctx.prisma.category.update({
        where: { id },
        data: {
          slug: input.slug ?? undefined,
          translations:
            input.translations === undefined || input.translations === null
              ? undefined
              : (input.translations as Prisma.InputJsonValue),
          parentId: input.parentId ?? undefined,
          icon: input.icon ?? undefined,
          color: input.color ?? undefined,
          taxDeductible: input.taxDeductible ?? undefined,
          taxCode: input.taxCode ?? undefined,
        },
      });
      return { categoryId: updated.id };
    },
  }),
);

builder.mutationField("deleteCategory", (t) =>
  t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const existing = await ctx.prisma.category.findFirst({
        where: { id, userId: user.id, isSystem: false },
      });
      if (!existing) {
        throw new GraphQLError("Category not found or not deletable", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await ctx.prisma.category.delete({ where: { id } });
      return true;
    },
  }),
);
