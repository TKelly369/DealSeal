import { prisma } from "./prisma.js";
import { getQueueConnection } from "../queue/connection.js";

export const SERVICE_ID = "dealseal-api";

/**
 * Liveness: process is up. Checks Postgres only.
 */
export async function checkLivenessWithDatabase(): Promise<
  { ok: true; database: true; time: string } | { ok: false; database: false; time: string; code: "DATABASE_UNREACHABLE" }
> {
  const time = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, database: true, time };
  } catch {
    return { ok: false, database: false, time, code: "DATABASE_UNREACHABLE" };
  }
}

/**
 * Readiness: Postgres + Redis when configured.
 */
export async function checkReadiness(): Promise<{
  ok: boolean;
  time: string;
  database: boolean;
  redis: "ok" | "skipped" | "unavailable";
  code?: "DATABASE_UNREACHABLE" | "REDIS_UNREACHABLE";
}> {
  const time = new Date().toISOString();
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    return { ok: false, time, database: false, redis: "skipped", code: "DATABASE_UNREACHABLE" };
  }
  const q = getQueueConnection();
  if (!q) {
    return { ok: true, time, database: true, redis: "skipped" };
  }
  try {
    await q.ping();
    return { ok: true, time, database: true, redis: "ok" };
  } catch {
    return { ok: false, time, database: true, redis: "unavailable", code: "REDIS_UNREACHABLE" };
  }
}
