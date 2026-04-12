// ============================================================================
// apps/worker — queue definitions
// ----------------------------------------------------------------------------
// Central place where every BullMQ queue is declared. The API enqueues jobs
// by importing `queues.*.add(...)` from here.
// ============================================================================

import { env } from "@lifeos/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export interface ProcessDocumentJob {
  documentId: string;
}

export interface DetectSubscriptionsJob {
  userId: string;
}

export interface RecategorizeBankJob {
  userId: string;
  accountId?: string;
  force: boolean;
}

export interface SendRemindersJob {
  // no payload — runs on a schedule
  tick: string;
}

export const queues = {
  processDocument: new Queue<ProcessDocumentJob>("process-document", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }),
  detectSubscriptions: new Queue<DetectSubscriptionsJob>(
    "detect-subscriptions",
    {
      connection,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    },
  ),
  recategorizeBank: new Queue<RecategorizeBankJob>("recategorize-bank", {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  }),
  sendReminders: new Queue<SendRemindersJob>("send-reminders", {
    connection,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  }),
};
