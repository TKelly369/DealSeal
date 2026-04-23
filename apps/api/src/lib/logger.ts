import type { Env } from "../config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: LogLevel[] = ["debug", "info", "warn", "error"];

function parseLevel(s: string | undefined): number {
  const d = s?.toLowerCase() ?? "info";
  const i = levelOrder.indexOf(d as LogLevel);
  return i >= 0 ? i : 1;
}

let minLevel = parseLevel(process.env.LOG_LEVEL);

export function setLogLevelFromEnv(env: { LOG_LEVEL?: string }): void {
  if (env.LOG_LEVEL) minLevel = parseLevel(env.LOG_LEVEL);
}

function shouldLog(l: LogLevel): boolean {
  return levelOrder.indexOf(l) >= minLevel;
}

/**
 * JSON structured log line (one object per line) for production ingestion.
 */
export function log(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  if (!shouldLog(level)) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, f?: Record<string, unknown>) => log("debug", event, f),
  info: (event: string, f?: Record<string, unknown>) => log("info", event, f),
  warn: (event: string, f?: Record<string, unknown>) => log("warn", event, f),
  error: (event: string, f?: Record<string, unknown>) => log("error", event, f),
};
