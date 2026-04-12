// ============================================================================
// apps/api — User type + auth mutations
// ----------------------------------------------------------------------------
// Registers:
//   * User object type (Prisma-backed)
//   * AuthPayload
//   * Query.me
//   * Mutation.signUp / signIn / signOut / refreshToken
//   * Mutation.updateProfile / changePassword
//
// Input validation is done inline via Zod-free guards — the schema's
// @lifeos/utils package will house richer validators in a later iteration.
// ============================================================================

import { Locale, Prisma } from "@lifeos/db";
import { GraphQLError } from "graphql";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  issueAccessToken,
} from "../auth/tokens.js";

// --- User -------------------------------------------------------------------

builder.prismaObject("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    email: t.exposeString("email"),
    displayName: t.exposeString("displayName", { nullable: true }),
    locale: t.field({ type: Locale, resolve: (u) => u.locale }),
    currency: t.exposeString("currency"),
    timezone: t.exposeString("timezone"),
    emailVerified: t.exposeBoolean("emailVerified"),
    createdAt: t.field({
      type: "DateTime",
      resolve: (u) => u.createdAt.toISOString(),
    }),
  }),
});

// --- AuthPayload ------------------------------------------------------------

interface AuthPayloadShape {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

const AuthPayloadRef = builder
  .objectRef<AuthPayloadShape>("AuthPayload")
  .implement({
    fields: (t) => ({
      user: t.prismaField({
        type: "User",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.user.findUniqueOrThrow({
            ...query,
            where: { id: parent.userId },
          }),
      }),
      accessToken: t.exposeString("accessToken"),
      refreshToken: t.exposeString("refreshToken"),
      expiresAt: t.field({
        type: "DateTime",
        resolve: (p) => p.expiresAt.toISOString(),
      }),
    }),
  });

// --- Inputs -----------------------------------------------------------------

const SignUpInput = builder.inputType("SignUpInput", {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    displayName: t.string({ required: false }),
    locale: t.field({ type: Locale, required: false }),
    currency: t.string({ required: false }),
    timezone: t.string({ required: false }),
  }),
});

const SignInInput = builder.inputType("SignInInput", {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

const UpdateProfileInput = builder.inputType("UpdateProfileInput", {
  fields: (t) => ({
    displayName: t.string({ required: false }),
    locale: t.field({ type: Locale, required: false }),
    currency: t.string({ required: false }),
    timezone: t.string({ required: false }),
  }),
});

const ChangePasswordInput = builder.inputType("ChangePasswordInput", {
  fields: (t) => ({
    currentPassword: t.string({ required: true }),
    newPassword: t.string({ required: true }),
  }),
});

// --- Helpers ----------------------------------------------------------------

const MIN_PASSWORD_LEN = 10;

const assertPasswordStrength = (pw: string): void => {
  if (pw.length < MIN_PASSWORD_LEN) {
    throw new GraphQLError(
      `Password must be at least ${MIN_PASSWORD_LEN} characters`,
      { extensions: { code: "WEAK_PASSWORD" } },
    );
  }
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const issueSession = async (
  prismaClient: Prisma.TransactionClient | typeof import("@lifeos/db").prisma,
  user: { id: string; email: string },
  meta: { userAgent?: string | null; ipAddress?: string | null },
): Promise<AuthPayloadShape> => {
  const access = await issueAccessToken({ sub: user.id, email: user.email });
  const refresh = generateRefreshToken();
  await prismaClient.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });
  return {
    userId: user.id,
    accessToken: access.token,
    refreshToken: refresh.raw,
    expiresAt: access.expiresAt,
  };
};

// --- Query.me ---------------------------------------------------------------

builder.queryField("me", (t) =>
  t.prismaField({
    type: "User",
    nullable: true,
    resolve: (query, _parent, _args, ctx) => {
      if (!ctx.user) return null;
      return ctx.prisma.user.findUnique({
        ...query,
        where: { id: ctx.user.id },
      });
    },
  }),
);

// --- Mutations --------------------------------------------------------------

builder.mutationField("signUp", (t) =>
  t.field({
    type: AuthPayloadRef,
    args: { input: t.arg({ type: SignUpInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      assertPasswordStrength(input.password);
      const email = normalizeEmail(input.email);
      const existing = await ctx.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new GraphQLError("An account with this email already exists", {
          extensions: { code: "EMAIL_TAKEN" },
        });
      }
      const passwordHash = await hashPassword(input.password);
      const user = await ctx.prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: input.displayName ?? null,
          locale: input.locale ?? Locale.de,
          currency: input.currency ?? "EUR",
          timezone: input.timezone ?? "Europe/Berlin",
        },
      });
      ctx.logger.info({ userId: user.id }, "user signed up");
      return issueSession(ctx.prisma, user, {});
    },
  }),
);

builder.mutationField("signIn", (t) =>
  t.field({
    type: AuthPayloadRef,
    args: { input: t.arg({ type: SignInInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const email = normalizeEmail(input.email);
      const user = await ctx.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new GraphQLError("Invalid credentials", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      const ok = await verifyPassword(user.passwordHash, input.password);
      if (!ok) {
        throw new GraphQLError("Invalid credentials", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      return issueSession(ctx.prisma, user, {});
    },
  }),
);

builder.mutationField("signOut", (t) =>
  t.boolean({
    resolve: async (_parent, _args, ctx) => {
      const user = requireUser(ctx);
      await ctx.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    },
  }),
);

builder.mutationField("refreshToken", (t) =>
  t.field({
    type: AuthPayloadRef,
    args: { refreshToken: t.arg.string({ required: true }) },
    resolve: async (_parent, { refreshToken }, ctx) => {
      const hash = hashRefreshToken(refreshToken);
      const session = await ctx.prisma.session.findUnique({
        where: { refreshTokenHash: hash },
        include: { user: true },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() < Date.now()
      ) {
        throw new GraphQLError("Refresh token invalid or expired", {
          extensions: { code: "REFRESH_INVALID" },
        });
      }
      // Rotation: revoke the old session, issue a new one.
      await ctx.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return issueSession(ctx.prisma, session.user, {
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
      });
    },
  }),
);

builder.mutationField("updateProfile", (t) =>
  t.prismaField({
    type: "User",
    args: { input: t.arg({ type: UpdateProfileInput, required: true }) },
    resolve: async (query, _parent, { input }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.user.update({
        ...query,
        where: { id: user.id },
        data: {
          displayName: input.displayName ?? undefined,
          locale: input.locale ?? undefined,
          currency: input.currency ?? undefined,
          timezone: input.timezone ?? undefined,
        },
      });
    },
  }),
);

builder.mutationField("changePassword", (t) =>
  t.boolean({
    args: { input: t.arg({ type: ChangePasswordInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      const ok = await verifyPassword(user.passwordHash, input.currentPassword);
      if (!ok) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      assertPasswordStrength(input.newPassword);
      const passwordHash = await hashPassword(input.newPassword);
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      // Invalidate all other sessions after password change.
      await ctx.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    },
  }),
);
