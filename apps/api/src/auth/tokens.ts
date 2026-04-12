// ============================================================================
// apps/api — JWT access + refresh token helpers
// ----------------------------------------------------------------------------
// Access tokens: short-lived, stateless, signed HS256.
// Refresh tokens: long-lived, stored as SHA-256 hash in `Session`, revocable.
//
// Never log or return raw refresh tokens outside the auth response payload.
// ============================================================================

import { createHash, randomBytes } from "node:crypto";
import { env } from "@lifeos/config";
import { SignJWT, jwtVerify } from "jose";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
}

export const issueAccessToken = async (
  claims: AccessTokenClaims,
): Promise<{ token: string; expiresAt: Date }> => {
  const expiresAt = new Date(Date.now() + env.JWT_ACCESS_TTL_SECONDS * 1000);
  const token = await new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("lifeos-api")
    .setAudience("lifeos-web")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(accessSecret);
  return { token, expiresAt };
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessTokenClaims | null> => {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      issuer: "lifeos-api",
      audience: "lifeos-web",
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
};

export const generateRefreshToken = (): {
  raw: string;
  hash: string;
  expiresAt: Date;
} => {
  const raw = randomBytes(48).toString("base64url");
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
  return { raw, hash, expiresAt };
};

export const hashRefreshToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");
