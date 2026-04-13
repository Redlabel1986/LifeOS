// ============================================================================
// Nuxt Server Route — POST /api/upload-camt
// ----------------------------------------------------------------------------
// Accepts a multipart/form-data CAMT.053 XML upload, bypassing the GraphQL
// body-size limit (Vercel 4.5 MB cap on serverless request bodies).
// ============================================================================

import { verifyAccessToken } from "@lifeos/api/auth/tokens";
import { importCamtFile } from "@lifeos/api/services/bank-sync";

export default defineEventHandler(async (event) => {
  // ---- Auth ----------------------------------------------------------------
  const authHeader = getHeader(event, "authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    throw createError({ statusCode: 401, statusMessage: "Invalid token" });
  }

  // ---- Parse multipart body ------------------------------------------------
  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: "No form data" });
  }

  let xmlBuffer: Buffer | null = null;
  let institutionName = "";

  for (const part of formData) {
    if (part.name === "file" && part.data) {
      xmlBuffer = part.data;
    }
    if (part.name === "institutionName" && part.data) {
      institutionName = part.data.toString("utf-8");
    }
  }

  if (!xmlBuffer || xmlBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file provided" });
  }

  // ---- Import --------------------------------------------------------------
  const xml = xmlBuffer.toString("utf-8");

  try {
    const result = await importCamtFile({
      userId: claims.sub,
      xml,
      institutionName: institutionName || undefined,
    });

    return {
      connectionId: result.connectionId,
      accountId: result.accountId,
      newTransactions: result.result.newTransactions,
      totalScanned: result.result.totalScanned,
      errors: result.result.errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw createError({ statusCode: 500, statusMessage: `CAMT import failed: ${message}` });
  }
});
