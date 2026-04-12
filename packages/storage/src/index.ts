// ============================================================================
// @lifeos/storage — Object storage adapter
// ----------------------------------------------------------------------------
// Three backends:
//   1. Vercel Blob  — used on Vercel (BLOB_READ_WRITE_TOKEN is set)
//   2. S3-compatible — used in prod with MinIO / real S3
//   3. Local FS      — dev fallback when neither is configured
//
// The active backend is chosen once at import time via `BLOB_READ_WRITE_TOKEN`.
// ============================================================================

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@lifeos/config";
import { randomUUID } from "node:crypto";
import { promises as fs, createReadStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";

// ---------------------------------------------------------------------------
// Detect active backend
// ---------------------------------------------------------------------------

const VERCEL_BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const useVercelBlob = Boolean(VERCEL_BLOB_TOKEN);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const extForMime = (mime: string, originalName?: string | null): string => {
  if (originalName && originalName.includes(".")) {
    const ext = originalName.split(".").pop();
    if (ext) return ext.toLowerCase();
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
};

// ---------------------------------------------------------------------------
// Local filesystem fallback (dev only)
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_DIR = resolve(
  process.env.LOCAL_STORAGE_DIR ?? join(process.cwd(), ".storage"),
);

const LOCAL_PREFIX = "local://";
const isLocal = (key: string): boolean => key.startsWith(LOCAL_PREFIX);
const localPath = (key: string): string =>
  join(LOCAL_STORAGE_DIR, key.slice(LOCAL_PREFIX.length));

// ---------------------------------------------------------------------------
// S3 client (dev / self-hosted)
// ---------------------------------------------------------------------------

const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export const DEFAULT_BUCKET = env.S3_BUCKET;

// ---------------------------------------------------------------------------
// Vercel Blob prefix
// ---------------------------------------------------------------------------

const BLOB_PREFIX = "blob://";
const isBlob = (key: string): boolean => key.startsWith(BLOB_PREFIX);
const blobUrl = (key: string): string => key.slice(BLOB_PREFIX.length);

// ---------------------------------------------------------------------------
// Upload ticket (presigned S3 — only used when S3 is the active backend)
// ---------------------------------------------------------------------------

export interface UploadTicket {
  storageKey: string;
  uploadUrl: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

export interface CreateUploadTicketInput {
  userId: string;
  mimeType: string;
  originalName?: string | null;
  expiresInSeconds?: number;
}

export const createUploadTicket = async (
  input: CreateUploadTicketInput,
): Promise<UploadTicket> => {
  const expiresIn = input.expiresInSeconds ?? 900;
  const ext = extForMime(input.mimeType, input.originalName);
  const storageKey = `documents/${input.userId}/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: storageKey,
    ContentType: input.mimeType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return {
    storageKey,
    uploadUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    headers: { "Content-Type": input.mimeType },
  };
};

// ---------------------------------------------------------------------------
// createDownloadUrl
// ---------------------------------------------------------------------------

export const createDownloadUrl = async (
  storageKey: string,
  expiresInSeconds = 300,
): Promise<string> => {
  // Vercel Blob URLs are already public / tokenized
  if (isBlob(storageKey)) {
    return blobUrl(storageKey);
  }

  if (isLocal(storageKey)) {
    return `local://${storageKey.slice(LOCAL_PREFIX.length)}`;
  }

  const command = new GetObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: storageKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
};

// ---------------------------------------------------------------------------
// headObject
// ---------------------------------------------------------------------------

export const headObject = async (
  storageKey: string,
): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }> => {
  if (isBlob(storageKey)) {
    try {
      const { head } = await import("@vercel/blob");
      const metadata = await head(blobUrl(storageKey), {
        token: VERCEL_BLOB_TOKEN!,
      });
      return {
        exists: true,
        sizeBytes: metadata.size,
        contentType: metadata.contentType,
      };
    } catch {
      return { exists: false };
    }
  }

  if (isLocal(storageKey)) {
    try {
      const stat = await fs.stat(localPath(storageKey));
      return { exists: true, sizeBytes: stat.size };
    } catch {
      return { exists: false };
    }
  }

  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: DEFAULT_BUCKET, Key: storageKey }),
    );
    return {
      exists: true,
      sizeBytes: res.ContentLength,
      contentType: res.ContentType,
    };
  } catch {
    return { exists: false };
  }
};

// ---------------------------------------------------------------------------
// deleteObject
// ---------------------------------------------------------------------------

export const deleteObject = async (storageKey: string): Promise<void> => {
  if (isBlob(storageKey)) {
    const { del } = await import("@vercel/blob");
    await del(blobUrl(storageKey), { token: VERCEL_BLOB_TOKEN! });
    return;
  }

  if (isLocal(storageKey)) {
    await fs.unlink(localPath(storageKey)).catch(() => undefined);
    return;
  }

  await client.send(
    new DeleteObjectCommand({ Bucket: DEFAULT_BUCKET, Key: storageKey }),
  );
};

// ---------------------------------------------------------------------------
// getObjectStream
// ---------------------------------------------------------------------------

export const getObjectStream = async (
  storageKey: string,
): Promise<Readable | NodeJS.ReadableStream | undefined> => {
  if (isBlob(storageKey)) {
    const response = await fetch(blobUrl(storageKey));
    if (!response.body) return undefined;
    return Readable.fromWeb(response.body as any);
  }

  if (isLocal(storageKey)) {
    return createReadStream(localPath(storageKey));
  }

  const res = await client.send(
    new GetObjectCommand({ Bucket: DEFAULT_BUCKET, Key: storageKey }),
  );
  return res.Body as Readable | undefined;
};

// ---------------------------------------------------------------------------
// writeFile — the main "put bytes into storage" function
// ---------------------------------------------------------------------------
// On Vercel:  uses @vercel/blob put()
// Elsewhere:  uses local filesystem

export const writeFile = async (input: {
  userId: string;
  mimeType: string;
  originalName?: string | null;
  bytes: Buffer;
}): Promise<{ storageKey: string; sizeBytes: number }> => {
  const ext = extForMime(input.mimeType, input.originalName);
  const id = randomUUID();
  const pathname = `documents/${input.userId}/${id}.${ext}`;

  if (useVercelBlob) {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, input.bytes, {
      access: "public",
      contentType: input.mimeType,
      token: VERCEL_BLOB_TOKEN!,
    });
    return {
      storageKey: `${BLOB_PREFIX}${blob.url}`,
      sizeBytes: input.bytes.length,
    };
  }

  // Local filesystem fallback
  const fullPath = join(LOCAL_STORAGE_DIR, pathname);
  await fs.mkdir(dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.bytes);
  return {
    storageKey: `${LOCAL_PREFIX}${pathname}`,
    sizeBytes: input.bytes.length,
  };
};

// Keep backward-compat alias
export const writeLocalFile = writeFile;

export const readLocalFile = async (storageKey: string): Promise<Buffer> => {
  if (isBlob(storageKey)) {
    const response = await fetch(blobUrl(storageKey));
    return Buffer.from(await response.arrayBuffer());
  }
  if (!isLocal(storageKey)) throw new Error("Not a local storage key");
  return fs.readFile(localPath(storageKey));
};
