// ============================================================================
// Nuxt Server Route — POST /api/upload-camt
// ----------------------------------------------------------------------------
// Accepts a multipart/form-data CAMT.053 upload (.xml or .zip containing XML).
// Files are gzip-compressed client-side to stay within Vercel's 4.5 MB body
// limit. ZIP archives are extracted server-side to find the XML inside.
// ============================================================================

import { gunzipSync, inflateRawSync } from "node:zlib";
import { verifyAccessToken } from "@lifeos/api/auth/tokens";
import { importCamtFile } from "@lifeos/api/services/bank-sync";

// ---------------------------------------------------------------------------
// ZIP extraction — extracts the first .xml file from a ZIP archive
// ---------------------------------------------------------------------------

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

function extractXmlFromZip(zip: Buffer): Buffer {
  let offset = 0;

  while (offset + 30 <= zip.length) {
    // Local file header signature
    if (zip.readUInt32LE(offset) !== 0x04034b50) break;

    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const uncompressedSize = zip.readUInt32LE(offset + 22);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const fileName = zip.subarray(offset + 30, offset + 30 + nameLen).toString("utf-8");
    const dataStart = offset + 30 + nameLen + extraLen;

    if (fileName.toLowerCase().endsWith(".xml")) {
      const raw = zip.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return raw; // stored
      if (method === 8) return inflateRawSync(raw); // deflate
      throw new Error(`Unsupported ZIP compression method ${method} for ${fileName}`);
    }

    offset = dataStart + compressedSize;
  }

  throw new Error("No .xml file found inside the ZIP archive");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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

  let fileBuffer: Buffer | null = null;
  let institutionName = "";
  let encoding = "";

  for (const part of formData) {
    if (part.name === "file" && part.data) {
      fileBuffer = part.data;
    }
    if (part.name === "institutionName" && part.data) {
      institutionName = part.data.toString("utf-8");
    }
    if (part.name === "encoding" && part.data) {
      encoding = part.data.toString("utf-8");
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file provided" });
  }

  // ---- Decompress gzip wrapper (client-side compression) -------------------
  if (encoding === "gzip") {
    fileBuffer = gunzipSync(fileBuffer);
  }

  // ---- Extract XML from ZIP if needed --------------------------------------
  if (isZip(fileBuffer)) {
    fileBuffer = extractXmlFromZip(fileBuffer);
  }

  // ---- Import --------------------------------------------------------------
  const xml = fileBuffer.toString("utf-8");

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
