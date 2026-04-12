import { env, isDevelopment } from "@lifeos/config";
import pino, { type Logger } from "pino";

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "worker" },
  ...(isDevelopment()
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l" },
        },
      }
    : {}),
});
