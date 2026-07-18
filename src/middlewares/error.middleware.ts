import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../common/errors/AppError.js";
import { env } from "../config/env.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("Route not found", 404));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 10MB"
        : err.message;
    res.status(400).json({
      success: false,
      message,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      })),
    });
    return;
  }

  console.error(err);

  res.status(500).json({
    success: false,
    message: env.NODE_ENV === "production" ? "Internal server error" : String(err),
  });
}
