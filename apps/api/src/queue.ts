// ============================================================================
// apps/api — queue facade
// ----------------------------------------------------------------------------
// Routes jobs to BullMQ (when Redis is available) or runs them in-process
// as a fallback for dev environments without Redis.
// ============================================================================

import { env } from "@lifeos/config";
import { logger } from "./logger.js";
import { processDocument } from "./services/document-processor.js";
import { recategorizeBankAccount } from "./services/bank-sync.js";

interface RecategorizeInput {
  userId: string;
  accountId?: string;
  force: boolean;
}

interface JobQueue {
  enqueueProcessDocument(documentId: string): Promise<void>;
  enqueueRecategorizeBank(input: RecategorizeInput): Promise<void>;
}

let cached: JobQueue | null = null;

const buildInProcessQueue = (): JobQueue => ({
  async enqueueProcessDocument(documentId) {
    setImmediate(() => {
      processDocument(documentId).catch((err) => {
        logger.error({ err, documentId }, "inline processDocument failed");
      });
    });
  },
  async enqueueRecategorizeBank(input) {
    setImmediate(() => {
      recategorizeBankAccount(input).catch((err) => {
        logger.error({ err }, "inline recategorizeBank failed");
      });
    });
  },
});

const buildBullMQQueue = async (): Promise<JobQueue> => {
  const { Queue } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;
  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const recategorizeQueue = new Queue("recategorize-bank", {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  });

  const processDocumentQueue = new Queue("process-document", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  return {
    async enqueueProcessDocument(documentId) {
      await processDocumentQueue.add("process", { documentId });
    },
    async enqueueRecategorizeBank(input) {
      await recategorizeQueue.add("recategorize", input);
    },
  };
};

export const getQueue = async (): Promise<JobQueue> => {
  if (cached) return cached;
  if (env.REDIS_URL) {
    try {
      cached = await buildBullMQQueue();
      logger.info("queue: using BullMQ (Redis)");
    } catch (err) {
      logger.warn({ err }, "queue: BullMQ init failed, falling back to in-process");
      cached = buildInProcessQueue();
    }
  } else {
    cached = buildInProcessQueue();
  }
  return cached;
};
