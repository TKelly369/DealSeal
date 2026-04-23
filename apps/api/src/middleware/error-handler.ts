import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    code: "INTERNAL",
    message: "Internal server error",
  });
}
