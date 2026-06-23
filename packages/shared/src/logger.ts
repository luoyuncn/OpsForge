import pino, { type Logger } from "pino";

export function createLogger(name: string): Logger {
  return pino({ name, level: process.env.OPSFORGE_LOG_LEVEL ?? "info" });
}
