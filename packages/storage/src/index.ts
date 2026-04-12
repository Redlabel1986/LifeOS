// ============================================================================
// @lifeos/storage — S3-compatible object storage adapter
// ----------------------------------------------------------------------------
// Works with MinIO in dev and real S3 in prod via the same API.
// Exposes presigned URLs for direct client uploads/downloads so large files
// never transit the API server.
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

// ----------------------------------------------------------------------------
// Local filesystem fallback
// ----------------------------------------------------------------------------
//
// In dev without MinIO, we write files to a local directory and store
// `local://<relativePath>` as the `storageKey`. The S3 helpers below detect
// this prefix and route to the filesystem instead.

const LOCAL_STORAGE_DIR = resolve(
  process.env.LOCAL_STORAGE_DIR ?? join(process.cwd(), ".storage"),
);

const LOCAL_PREFIX = "local://";
const isLocal = (key: string): boolean => key.startsWith(LOCAL_PREFIX);
const localPath = (key: string): string =>
  join(LOCAL_STORAGE_DIR, key.slice(LOCAL_PREFIX.length));

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

export const createDownloadUrl = async (
  storageKey: string,
  expiresInSeconds = 300,
): Promise<string> => {
  if (isLocal(storageKey)) {
    // Local files are streamed via the API's /files/:id endpoint instead of
    // a presigned URL. The web layer reads `Document.downloadUrl` and that
    // resolver substitutes the right path. For backward-compat, return a
    // marker that callers can detect.
    return `local://${storageKey.slice(LOCAL_PREFIX.length)}`;
  }
  const command = new GetObjectCommand({
    Bucket: DEFAULT_BUCKET,
    Key: storageKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
};

export const headObject = async (
  storageKey: string,
): Promise<{ exists: boolean; sizeBytes?: number; contentType?: string }> => {
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

export const deleteObject = async (storageKey: string): Promise<void> => {
  if (isLocal(storageKey)) {
    await fs.unlink(localPath(storageKey)).catch(() => undefined);
    return;
  }
  await client.send(
    new DeleteObjectCommand({ Bucket: DEFAULT_BUCKET, Key: storageKey }),
  );
};

export const getObjectStream = async (
  storageKey: string,
): Promise<Readable | NodeJS.ReadableStream | undefined> => {
  if (isLocal(storageKey)) {
    return createReadStream(localPath(storageKey));
  }
  const res = await client.send(
    new GetObjectCommand({ Bucket: DEFAULT_BUCKET, Key: storageKey }),
  );
  return res.Body as Readable | undefined;
};

/**
 * Write a buffer to local storage and return its `local://` storageKey.
 * Used by the inline-upload mutation when no S3 backend is available.
 */
export const writeLocalFile = async (input: {
  userId: string;
  mimeType: string;
  originalName?: string | null;
  bytes: Buffer;
}): Promise<{ storageKey: string; sizeBytes: number }> => {
  const ext = extForMime(input.mimeType, input.originalName);
  const id = randomUUID();
  const relative = `documents/${input.userId}/${id}.${ext}`;
  const fullPath = join(LOCAL_STORAGE_DIR, relative);
  await fs.mkdir(dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.bytes);
  return {
    storageKey: `${LOCAL_PREFIX}${relative}`,
    sizeBytes: input.bytes.length,
  };
};

export const readLocalFile = async (storageKey: string): Promise<Buffer> => {
  if (!isLocal(storageKey)) throw new Error("Not a local storage key");
  return fs.readFile(localPath(storageKey));
};
