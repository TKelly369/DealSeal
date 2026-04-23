import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@dealseal/shared";
import { HttpError } from "../lib/http-error.js";
import type { Env } from "../config/env.js";
import { requireNotAuditorOnlyOnMutation } from "./auditor-guard.js";

export interface AuthPayload {
  sub: string;
  orgId: string;
  roles: UserRole[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function createAuthMiddleware(env: Env) {
  const auditor = requireNotAuditorOnlyOnMutation();
  return function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next(new HttpError(401, "Unauthorized", "AUTH_REQUIRED"));
      return;
    }
    const token = header.slice("Bearer ".length);
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      req.auth = decoded;
      auditor(req, res, next);
    } catch {
      next(new HttpError(401, "Invalid token", "AUTH_INVALID"));
    }
  };
}

export function requireRoles(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new HttpError(401, "Unauthorized", "AUTH_REQUIRED"));
      return;
    }
    const ok = req.auth.roles.some((r) => allowed.includes(r));
    if (!ok) {
      next(new HttpError(403, "Forbidden", "FORBIDDEN"));
      return;
    }
    next();
  };
}
