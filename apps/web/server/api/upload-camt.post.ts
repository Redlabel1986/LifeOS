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

/**
 * Extracts the first .xml file from a ZIP archive using the Central Directory
 * (reliable even when local file headers have zeroed sizes due to data
 * descriptors / bit 3 of the general purpose flag).
 */
function extractXmlFromZip(zip: Buffer): Buffer {
  // 1. Find End of Central Directory record (EOCD) — scan backwards for 0x06054b50
  let eocdOffset = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Invalid ZIP: no End of Central Directory found");

  // 2. Read Central Directory offset and entry count from EOCD
  const cdEntries = zip.readUInt16LE(eocdOffset + 10);
  const cdOffset = zip.readUInt32LE(eocdOffset + 16);

  // 3. Walk Central Directory entries (signature 0x02014b50)
  let pos = cdOffset;
  for (let i = 0; i < cdEntries && pos + 46 <= zip.length; i++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) break;

    const method = zip.readUInt16LE(pos + 10);
    const compressedSize = zip.readUInt32LE(pos + 20);
    const nameLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const commentLen = zip.readUInt16LE(pos + 32);
    const localHeaderOffset = zip.readUInt32LE(pos + 42);
    const fileName = zip.subarray(pos + 46, pos + 46 + nameLen).toString("utf-8");

    if (fileName.toLowerCase().endsWith(".xml")) {
      // 4. Jump to local file header to find where the data actually starts
      const localNameLen = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const raw = zip.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) return raw; // stored (uncompressed)
      if (method === 8) return inflateRawSync(raw); // deflate
      throw new Error(`Unsupported ZIP compression method ${method} for ${fileName}`);
    }

    pos += 46 + nameLen + extraLen + commentLen;
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
