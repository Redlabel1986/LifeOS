// ============================================================================
// apps/api — logger
// ----------------------------------------------------------------------------
// Single pino logger instance. Pretty-prints in dev, JSON in prod.
// Everything logs through this — never `console.log`.
// ============================================================================

import { env, isDevelopment } from "@lifeos/config";
import pino, { type Logger } from "pino";

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "api" },
  ...(isDevelopment()
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service",
          },
        },
      }
    : {}),
});
