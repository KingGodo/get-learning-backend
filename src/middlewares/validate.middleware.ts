import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../common/errors/AppError.js";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodType, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[part]);

      if (part === "body") {
        req.body = parsed;
      } else {
        // query/params are getter-only on IncomingMessage in newer Node/Express —
        // mutate the existing object instead of replacing it
        const current = req[part] as Record<string, unknown>;
        for (const key of Object.keys(current)) {
          delete current[key];
        }
        Object.assign(current, parsed as object);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join(".") || part,
          message: issue.message,
        }));

        const message = details.map((d) => `${d.field}: ${d.message}`).join("; ");
        next(new AppError(message || "Validation failed", 422, details));
        return;
      }
      next(error);
    }
  };
}
