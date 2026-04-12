// ============================================================================
// worker/jobs/send-reminders
// ----------------------------------------------------------------------------
// Scans SubscriptionReminder rows due for delivery, sends the email, marks
// them sent. Also auto-creates reminders for subscriptions with a
// cancellationDeadline 14 days out.
// ============================================================================

import {
  prisma,
  ReminderChannel,
  SubscriptionStatus,
} from "@lifeos/db";
import { sendMail } from "@lifeos/mail";
import { formatDate, type SupportedLocale } from "@lifeos/utils";
import { Worker, type Job } from "bullmq";
import { connection, type SendRemindersJob } from "../queue.js";
import { logger } from "../logger.js";

const REMINDER_WINDOW_DAYS = 14;

const ensureReminders = async (): Promise<void> => {
  const threshold = new Date(
    Date.now() + REMINDER_WINDOW_DAYS * 86_400_000,
  );
  const subs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      cancellationDeadline: { not: null, lte: threshold, gte: new Date() },
    },
    select: { id: true, cancellationDeadline: true },
  });
  for (const s of subs) {
    if (!s.cancellationDeadline) continue;
    const existing = await prisma.subscriptionReminder.findFirst({
      where: { subscriptionId: s.id, sentAt: null },
    });
    if (existing) continue;
    const remindAt = new Date(
      s.cancellationDeadline.getTime() - 7 * 86_400_000,
    );
    await prisma.subscriptionReminder.create({
      data: {
        subscriptionId: s.id,
        remindAt,
        channel: ReminderChannel.EMAIL,
      },
    });
  }
};

const dispatchDueReminders = async (): Promise<void> => {
  const due = await prisma.subscriptionReminder.findMany({
    where: { sentAt: null, remindAt: { lte: new Date() } },
    include: {
      subscription: { include: { user: true } },
    },
    take: 50,
  });
  for (const r of due) {
    const sub = r.subscription;
    const user = sub.user;
    const locale = user.locale as SupportedLocale;
    const deadline = sub.cancellationDeadline
      ? formatDate(sub.cancellationDeadline, locale)
      : "-";

    const localized: Record<
      SupportedLocale,
      { subject: string; body: string }
    > = {
      de: {
        subject: `Erinnerung: ${sub.name} Kündigungsfrist am ${deadline}`,
        body: `Hallo ${user.displayName ?? ""},\n\nDein Abonnement "${sub.name}" kann bis zum ${deadline} gekündigt werden.\n\nLifeOS`,
      },
      en: {
        subject: `Reminder: cancel ${sub.name} by ${deadline}`,
        body: `Hi ${user.displayName ?? ""},\n\nYour subscription "${sub.name}" can be cancelled until ${deadline}.\n\nLifeOS`,
      },
      fr: {
        subject: `Rappel : résiliation ${sub.name} avant le ${deadline}`,
        body: `Bonjour ${user.displayName ?? ""},\n\nVotre abonnement "${sub.name}" peut être résilié jusqu'au ${deadline}.\n\nLifeOS`,
      },
      ar: {
        subject: `تذكير: إلغاء ${sub.name} قبل ${deadline}`,
        body: `مرحباً ${user.displayName ?? ""}،\n\nيمكنك إلغاء اشتراك "${sub.name}" حتى ${deadline}.\n\nLifeOS`,
      },
    };
    const msg = localized[locale];

    try {
      await sendMail({
        to: user.email,
        subject: msg.subject,
        text: msg.body,
      });
      await prisma.subscriptionReminder.update({
        where: { id: r.id },
        data: { sentAt: new Date() },
      });
      logger.info({ reminderId: r.id, userId: user.id }, "reminder sent");
    } catch (err) {
      logger.error({ err, reminderId: r.id }, "reminder send failed");
    }
  }
};

export const startSendRemindersWorker = (): Worker<SendRemindersJob> =>
  new Worker<SendRemindersJob>(
    "send-reminders",
    async (_job: Job<SendRemindersJob>) => {
      await ensureReminders();
      await dispatchDueReminders();
    },
    { connection, concurrency: 1 },
  );
