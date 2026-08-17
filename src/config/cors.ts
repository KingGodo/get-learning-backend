import type { CorsOptions } from "cors";
import { env } from "./env.js";

function originList(): string[] {
  const extras = env.CORS_ORIGINS.split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return [
    env.FRONTEND_URL.replace(/\/$/, ""),
    ...extras,
  ];
}

export function corsOptions(): CorsOptions {
  if (env.NODE_ENV !== "production") {
    return { origin: true };
  }

  const allowed = new Set(originList());

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin.replace(/\/$/, ""))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}
