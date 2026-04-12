// ============================================================================
// apps/worker — entry
// ----------------------------------------------------------------------------
// Starts every job worker and schedules recurring jobs.
// ============================================================================

import { prisma } from "@lifeos/db";
import { logger } from "./logger.js";
import { startDetectSubscriptionsWorker } from "./jobs/detect-subscriptions.js";
import { startProcessDocumentWorker } from "./jobs/process-document.js";
import { startRecategorizeBankWorker } from "./jobs/recategorize-bank.js";
import { startSendRemindersWorker } from "./jobs/send-reminders.js";
import { queues } from "./queue.js";

const start = async (): Promise<void> => {
  const workers = [
    startProcessDocumentWorker(),
    startDetectSubscriptionsWorker(),
    startRecategorizeBankWorker(),
    startSendRemindersWorker(),
  ];

  // Schedule reminders check every hour.
  await queues.sendReminders.add(
    "hourly",
    { tick: new Date().toISOString() },
    {
      repeat: { pattern: "0 * * * *" },
      jobId: "reminders-hourly",
    },
  );

  logger.info("lifeos worker started");

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, "shutting down workers");
    await Promise.all(workers.map((w) => w.close()));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
