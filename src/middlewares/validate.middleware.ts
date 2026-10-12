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
        // Express reads req.query through a prototype getter that parses the URL
        // again on every access. Writing onto that object is discarded, so
        // coerced numbers stay strings. An own property shadows the getter.
        Object.defineProperty(req, part, {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
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
