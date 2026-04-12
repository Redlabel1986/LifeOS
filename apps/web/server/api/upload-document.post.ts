// ============================================================================
// Nuxt Server Route — POST /api/upload-document
// ----------------------------------------------------------------------------
// Accepts a multipart/form-data upload, stores the file in Vercel Blob (or
// local FS in dev), creates a Document record, and returns the document ID.
//
// This bypasses the GraphQL body-size limit that makes base64 uploads fail
// on Vercel serverless (4.5 MB cap).
// ============================================================================

import { prisma, DocumentStatus, DocumentType } from "@lifeos/db";
import { writeFile } from "@lifeos/storage";
import { verifyAccessToken } from "@lifeos/api/auth/tokens";

const VALID_TYPES = new Set(Object.values(DocumentType));
const MAX_SIZE = 25 * 1024 * 1024; // 25 MiB

export default defineEventHandler(async (event) => {
  // ---- Auth ----------------------------------------------------------------
  const authHeader =
    getHeader(event, "authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    throw createError({ statusCode: 401, statusMessage: "Invalid token" });
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "User not found" });
  }

  // ---- Parse multipart body ------------------------------------------------
  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: "No form data" });
  }

  let fileBuffer: Buffer | null = null;
  let mimeType = "application/octet-stream";
  let originalName = "upload";
  let docType: DocumentType = DocumentType.OTHER;

  for (const part of formData) {
    if (part.name === "file" && part.data) {
      fileBuffer = part.data;
      mimeType = part.type ?? mimeType;
      originalName = part.filename ?? originalName;
    }
    if (part.name === "type" && part.data) {
      const val = part.data.toString("utf-8");
      if (VALID_TYPES.has(val as DocumentType)) {
        docType = val as DocumentType;
      }
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file provided" });
  }

  if (fileBuffer.length > MAX_SIZE) {
    throw createError({ statusCode: 413, statusMessage: "File too large" });
  }

  // ---- Upload to storage ---------------------------------------------------
  const written = await writeFile({
    userId: user.id,
    mimeType,
    originalName,
    bytes: fileBuffer,
  });

  // ---- Create document record ----------------------------------------------
  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      type: docType,
      status: DocumentStatus.UPLOADED,
      storageKey: written.storageKey,
      storageBucket: written.storageKey.startsWith("blob://")
        ? "vercel-blob"
        : "local",
      mimeType,
      sizeBytes: written.sizeBytes,
      originalName,
    },
  });

  return { documentId: doc.id, status: doc.status };
});
