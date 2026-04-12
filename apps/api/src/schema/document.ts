// ============================================================================
// apps/api — Document type + upload flow
// ----------------------------------------------------------------------------
// Upload flow:
//   1. Client calls requestDocumentUpload → gets a presigned PUT URL.
//   2. Client uploads bytes directly to S3.
//   3. Client calls confirmDocumentUpload → document moves to PROCESSING
//      and the worker picks it up.
// ============================================================================

import { DocumentStatus, DocumentType, Prisma } from "@lifeos/db";
import {
  createDownloadUrl,
  createUploadTicket,
  deleteObject,
  headObject,
  writeFile,
} from "@lifeos/storage";
import { GraphQLError } from "graphql";
import { getQueue } from "../queue.js";
import { builder } from "./builder.js";
import { requireUser } from "../context.js";
import { DateRangeInput, PageInfoRef, PageInput, normalizePage } from "./shared.js";

// --- Document object --------------------------------------------------------

builder.prismaObject("Document", {
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.field({ type: DocumentType, resolve: (d) => d.type }),
    status: t.field({ type: DocumentStatus, resolve: (d) => d.status }),
    mimeType: t.exposeString("mimeType"),
    sizeBytes: t.exposeInt("sizeBytes"),
    originalName: t.exposeString("originalName", { nullable: true }),
    language: t.exposeString("language", { nullable: true }),
    summary: t.exposeString("summary", { nullable: true }),
    aiTags: t.exposeStringList("aiTags"),
    extracted: t.field({
      type: "JSON",
      nullable: true,
      resolve: (d) => (d.extracted as unknown) ?? null,
    }),
    downloadUrl: t.string({
      resolve: (d) => createDownloadUrl(d.storageKey),
    }),
    uploadedAt: t.field({
      type: "DateTime",
      resolve: (d) => d.uploadedAt.toISOString(),
    }),
    processedAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (d) => d.processedAt?.toISOString() ?? null,
    }),
    transactions: t.relation("transactions"),
  }),
});

// --- Page -------------------------------------------------------------------

interface DocumentPageShape {
  items: Array<{ id: string }>;
  totalCount: number;
  limit: number;
  offset: number;
}

const DocumentPageRef = builder
  .objectRef<DocumentPageShape>("DocumentPage")
  .implement({
    fields: (t) => ({
      items: t.prismaField({
        type: ["Document"],
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.document.findMany({
            ...query,
            where: { id: { in: parent.items.map((i) => i.id) } },
            orderBy: { uploadedAt: "desc" },
          }),
      }),
      pageInfo: t.field({
        type: PageInfoRef,
        resolve: (p) => ({
          totalCount: p.totalCount,
          hasMore: p.offset + p.items.length < p.totalCount,
          limit: p.limit,
          offset: p.offset,
        }),
      }),
    }),
  });

// --- Upload ticket ----------------------------------------------------------

interface UploadTicketShape {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

const DocumentUploadTicketRef = builder
  .objectRef<UploadTicketShape>("DocumentUploadTicket")
  .implement({
    fields: (t) => ({
      documentId: t.exposeID("documentId"),
      uploadUrl: t.exposeString("uploadUrl"),
      storageKey: t.exposeString("storageKey"),
      expiresAt: t.field({
        type: "DateTime",
        resolve: (p) => p.expiresAt.toISOString(),
      }),
      requiredHeaders: t.field({
        type: "JSON",
        resolve: (p) => p.headers,
      }),
    }),
  });

// --- Inputs -----------------------------------------------------------------

const RequestDocumentUploadInput = builder.inputType(
  "RequestDocumentUploadInput",
  {
    fields: (t) => ({
      type: t.field({ type: DocumentType, required: true }),
      mimeType: t.string({ required: true }),
      sizeBytes: t.int({ required: true }),
      originalName: t.string({ required: false }),
      checksumSha256: t.string({ required: false }),
    }),
  },
);

const ConfirmDocumentUploadInput = builder.inputType(
  "ConfirmDocumentUploadInput",
  {
    fields: (t) => ({
      documentId: t.id({ required: true }),
    }),
  },
);

const DocumentFilter = builder.inputType("DocumentFilter", {
  fields: (t) => ({
    types: t.field({ type: [DocumentType], required: false }),
    statuses: t.field({ type: [DocumentStatus], required: false }),
    dateRange: t.field({ type: DateRangeInput, required: false }),
    search: t.string({ required: false }),
  }),
});

interface DocumentPayloadShape {
  documentId: string;
}

const DocumentPayloadRef = builder
  .objectRef<DocumentPayloadShape>("DocumentPayload")
  .implement({
    fields: (t) => ({
      document: t.prismaField({
        type: "Document",
        resolve: (query, parent, _args, ctx) =>
          ctx.prisma.document.findUniqueOrThrow({
            ...query,
            where: { id: parent.documentId },
          }),
      }),
    }),
  });

// --- Queries ----------------------------------------------------------------

builder.queryField("document", (t) =>
  t.prismaField({
    type: "Document",
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _parent, { id }, ctx) => {
      const user = requireUser(ctx);
      return ctx.prisma.document.findFirst({
        ...query,
        where: { id, userId: user.id },
      });
    },
  }),
);

builder.queryField("documents", (t) =>
  t.field({
    type: DocumentPageRef,
    args: {
      filter: t.arg({ type: DocumentFilter, required: false }),
      page: t.arg({ type: PageInput, required: false }),
    },
    resolve: async (_parent, { filter, page }, ctx) => {
      const user = requireUser(ctx);
      const { limit, offset } = normalizePage(page);
      const where: Prisma.DocumentWhereInput = { userId: user.id };
      if (filter?.types?.length) where.type = { in: filter.types };
      if (filter?.statuses?.length) where.status = { in: filter.statuses };
      if (filter?.dateRange)
        where.uploadedAt = {
          gte: new Date(filter.dateRange.from),
          lte: new Date(filter.dateRange.to),
        };
      if (filter?.search)
        where.OR = [
          { originalName: { contains: filter.search, mode: "insensitive" } },
          { ocrText: { contains: filter.search, mode: "insensitive" } },
          { summary: { contains: filter.search, mode: "insensitive" } },
        ];
      const [items, totalCount] = await Promise.all([
        ctx.prisma.document.findMany({
          where,
          orderBy: { uploadedAt: "desc" },
          take: limit,
          skip: offset,
          select: { id: true },
        }),
        ctx.prisma.document.count({ where }),
      ]);
      return { items, totalCount, limit, offset };
    },
  }),
);

// --- Mutations --------------------------------------------------------------

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB

// ----------------------------------------------------------------------------
// Inline upload — base64 in a single GraphQL mutation. Bypasses presigned
// S3 URLs entirely. Works in dev without MinIO; uses local FS storage.
// For production with S3, prefer requestDocumentUpload + confirmDocumentUpload.
// ----------------------------------------------------------------------------

const UploadDocumentInput = builder.inputType("UploadDocumentInput", {
  fields: (t) => ({
    type: t.field({ type: DocumentType, required: true }),
    mimeType: t.string({ required: true }),
    originalName: t.string({ required: false }),
    fileBase64: t.string({ required: true }),
  }),
});

builder.mutationField("uploadDocument", (t) =>
  t.field({
    type: DocumentPayloadRef,
    args: { input: t.arg({ type: UploadDocumentInput, required: true }) },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      let bytes: Buffer;
      try {
        bytes = Buffer.from(input.fileBase64, "base64");
      } catch {
        throw new GraphQLError("Invalid base64 payload", {
          extensions: { code: "INVALID_INPUT" },
        });
      }
      if (bytes.length === 0) {
        throw new GraphQLError("Empty file", {
          extensions: { code: "EMPTY_FILE" },
        });
      }
      if (bytes.length > MAX_UPLOAD_BYTES) {
        throw new GraphQLError("File too large", {
          extensions: { code: "FILE_TOO_LARGE" },
        });
      }

      const written = await writeFile({
        userId: user.id,
        mimeType: input.mimeType,
        originalName: input.originalName,
        bytes,
      });

      const doc = await ctx.prisma.document.create({
        data: {
          userId: user.id,
          type: input.type,
          status: DocumentStatus.PROCESSING,
          storageKey: written.storageKey,
          storageBucket: written.storageKey.startsWith("blob://") ? "vercel-blob" : "local",
          mimeType: input.mimeType,
          sizeBytes: written.sizeBytes,
          originalName: input.originalName ?? null,
        },
      });

      const queue = await getQueue();
      await queue.enqueueProcessDocument(doc.id);

      return { documentId: doc.id };
    },
  }),
);

builder.mutationField("requestDocumentUpload", (t) =>
  t.field({
    type: DocumentUploadTicketRef,
    args: {
      input: t.arg({ type: RequestDocumentUploadInput, required: true }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      if (input.sizeBytes > MAX_UPLOAD_BYTES) {
        throw new GraphQLError("File too large", {
          extensions: { code: "FILE_TOO_LARGE" },
        });
      }
      const ticket = await createUploadTicket({
        userId: user.id,
        mimeType: input.mimeType,
        originalName: input.originalName,
      });
      const doc = await ctx.prisma.document.create({
        data: {
          userId: user.id,
          type: input.type,
          status: DocumentStatus.UPLOADED,
          storageKey: ticket.storageKey,
          storageBucket: "lifeos-documents",
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          originalName: input.originalName ?? null,
          checksumSha256: input.checksumSha256 ?? null,
        },
      });
      return {
        documentId: doc.id,
        uploadUrl: ticket.uploadUrl,
        storageKey: ticket.storageKey,
        expiresAt: ticket.expiresAt,
        headers: ticket.headers,
      };
    },
  }),
);

builder.mutationField("confirmDocumentUpload", (t) =>
  t.field({
    type: DocumentPayloadRef,
    args: {
      input: t.arg({ type: ConfirmDocumentUploadInput, required: true }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      const doc = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, userId: user.id },
      });
      if (!doc) {
        throw new GraphQLError("Document not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const head = await headObject(doc.storageKey);
      if (!head.exists) {
        throw new GraphQLError("Upload has not completed", {
          extensions: { code: "UPLOAD_INCOMPLETE" },
        });
      }
      await ctx.prisma.document.update({
        where: { id: doc.id },
        data: {
          status: DocumentStatus.PROCESSING,
          sizeBytes: head.sizeBytes ?? doc.sizeBytes,
        },
      });
      const queue = await getQueue();
      await queue.enqueueProcessDocument(doc.id);
      return { documentId: doc.id };
    },
  }),
);

builder.mutationField("deleteDocument", (t) =>
  t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const doc = await ctx.prisma.document.findFirst({
        where: { id, userId: user.id },
      });
      if (!doc) {
        throw new GraphQLError("Document not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await deleteObject(doc.storageKey).catch(() => undefined);
      await ctx.prisma.document.delete({ where: { id } });
      return true;
    },
  }),
);

builder.mutationField("reprocessDocument", (t) =>
  t.field({
    type: DocumentPayloadRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const doc = await ctx.prisma.document.findFirst({
        where: { id, userId: user.id },
      });
      if (!doc) {
        throw new GraphQLError("Document not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await ctx.prisma.document.update({
        where: { id: doc.id },
        data: { status: DocumentStatus.PROCESSING, processedAt: null },
      });
      const queue = await getQueue();
      await queue.enqueueProcessDocument(doc.id);
      return { documentId: doc.id };
    },
  }),
);
