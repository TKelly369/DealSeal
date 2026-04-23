import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RedisCtor = require("ioredis") as new (
  url: string,
  options: { maxRetriesPerRequest: null; enableReadyCheck: boolean },
) => {
  ping(): Promise<string>;
};

type RedisClient = InstanceType<typeof RedisCtor>;

let shared: RedisClient | null = null;

/** BullMQ requires `maxRetriesPerRequest: null` on ioredis. */
export function getQueueConnection(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!shared) {
    shared = new RedisCtor(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return shared;
}

export function createWorkerConnection(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return new RedisCtor(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
