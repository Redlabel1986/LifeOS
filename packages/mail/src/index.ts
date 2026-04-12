// ============================================================================
// @lifeos/mail — outbound SMTP
// ----------------------------------------------------------------------------
// Uses nodemailer. In dev this points at MailHog (no auth). In prod it points
// at a real SMTP relay. Transport is lazily created on first send to avoid
// connection attempts in tests.
// ============================================================================

import { env } from "@lifeos/config";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return transporter;
};

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export const sendMail = async (
  input: SendMailInput,
): Promise<{ messageId: string }> => {
  const t = getTransporter();
  const info = await t.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  });
  return { messageId: info.messageId };
};
