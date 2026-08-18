import type { CorsOptions } from "cors";
import { env } from "./env.js";

function configuredHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const value of [
    env.FRONTEND_URL,
    env.PUBLIC_APP_URL,
    ...env.CORS_ORIGINS.split(","),
  ]) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    try {
      hosts.add(new URL(trimmed).hostname);
    } catch {
      hosts.add(trimmed.replace(/\/$/, ""));
    }
  }
  return hosts;
}

function isAllowedOrigin(origin: string): boolean {
  const normalized = origin.replace(/\/$/, "");
  const listed = new Set(
    [env.FRONTEND_URL, env.PUBLIC_APP_URL, ...env.CORS_ORIGINS.split(",")]
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
  if (listed.has(normalized)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (configuredHosts().has(hostname)) return true;
    // Allow access by droplet IP on any port (80, 3000, etc).
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return true;
  } catch {
    return false;
  }
  return false;
}

export function corsOptions(): CorsOptions {
  if (env.NODE_ENV !== "production") {
    return { origin: true };
  }

  return {
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}
