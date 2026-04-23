import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";

type Bucket = { n: number; reset: number };
const byKey = new Map<string, Bucket>();

function keyForRequest(req: Request, prefix: string): string {
  return `${prefix}:${req.ip ?? "unknown"}`;
}

export function createRateLimiter(input: { windowMs: number; max: number; prefix: string }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const k = keyForRequest(req, input.prefix);
    const now = Date.now();
    let b = byKey.get(k);
    if (!b || now > b.reset) {
      b = { n: 0, reset: now + input.windowMs };
      byKey.set(k, b);
    }
    b.n += 1;
    if (b.n > input.max) {
      next(
        new HttpError(429, "Too many requests", "RATE_LIMIT", {
          retryAfterMs: b.reset - now,
        }),
      );
      return;
    }
    next();
  };
}

export function createApiKeyRateLimiter(input: { windowMs: number; max: number }) {
  return (apiKeyId: string | undefined) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (!apiKeyId) {
        next();
        return;
      }
      const k = `apik:${apiKeyId}`;
      const now = Date.now();
      let b = byKey.get(k);
      if (!b || now > b.reset) {
        b = { n: 0, reset: now + input.windowMs };
        byKey.set(k, b);
      }
      b.n += 1;
      if (b.n > input.max) {
        next(new HttpError(429, "API key rate limit", "API_RATE_LIMIT"));
        return;
      }
      next();
    };
  };
}
