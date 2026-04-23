import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";
import { verifyApiKey, type PartnerAuth } from "../services/api-key-service.js";
import { byKey } from "./rate-limit-partner.js";

declare global {
  namespace Express {
    interface Request {
      partnerAuth?: PartnerAuth;
    }
  }
}

export function partnerApiKeyAuth(env: { RATE_LIMIT_WINDOW_MS: number; API_RATE_LIMIT_MAX: number }) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.headers["x-api-key"];
    if (typeof raw !== "string" || !raw) {
      next(new HttpError(401, "Missing X-API-Key", "API_KEY_REQUIRED"));
      return;
    }
    const p = await verifyApiKey(raw);
    if (!p) {
      next(new HttpError(401, "Invalid API key", "API_KEY_INVALID"));
      return;
    }
    const b = byKey.get(p.apiKeyId);
    const now = Date.now();
    const windowMs = env.RATE_LIMIT_WINDOW_MS;
    const max = env.API_RATE_LIMIT_MAX;
    if (b) {
      if (now > b.reset) {
        b.n = 0;
        b.reset = now + windowMs;
      }
      b.n += 1;
      if (b.n > max) {
        next(new HttpError(429, "API key rate limit", "API_RATE_LIMIT"));
        return;
      }
    } else {
      byKey.set(p.apiKeyId, { n: 1, reset: now + windowMs });
    }
    req.partnerAuth = p;
    next();
  };
}
