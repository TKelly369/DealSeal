import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Read-only: users whose only role is AUDITOR cannot POST/PATCH/DELETE/PUT.
 * Users with additional roles (e.g. ADMIN+AUDITOR) are allowed to mutate.
 */
export function requireNotAuditorOnlyOnMutation() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE.has(req.method)) {
      next();
      return;
    }
    // Stateless JWT: logout must be allowed for read-only users.
    const path = (req.baseUrl || "") + req.path;
    if (req.method === "POST" && path === "/auth/logout") {
      next();
      return;
    }
    const roles = req.auth?.roles ?? [];
    if (roles.length === 1 && roles[0] === "AUDITOR") {
      next(
        new HttpError(
          403,
          "Auditor role is read-only for this operation",
          "AUDITOR_READ_ONLY",
        ),
      );
      return;
    }
    next();
  };
}
