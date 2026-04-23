import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestLoggerMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = (req.headers["x-request-id"] as string) || randomUUID();
    req.requestId = id;
    res.setHeader("X-Request-Id", id);
    const t0 = Date.now();
    res.on("finish", () => {
      logger.info("http_request", {
        requestId: id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - t0,
      });
    });
    next();
  };
}
