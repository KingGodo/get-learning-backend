import os from "os";
import app from "./app.js";
import { env } from "./config/env.js";
import { isSupabaseConfigured } from "./config/supabase.js";
import { ensureStorageBucket } from "./modules/storage/storage.service.js";

function getNetworkUrls(port: number): string[] {
  const urls = new Set<string>([`http://localhost:${port}`]);
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        urls.add(`http://${net.address}:${port}`);
      }
    }
  }
  return [...urls];
}

async function start() {
  if (isSupabaseConfigured()) {
    try {
      await ensureStorageBucket();
      console.log(
        `Supabase storage bucket ready: ${env.SUPABASE_STORAGE_BUCKET}`,
      );
    } catch (err) {
      console.warn(
        "[storage] Could not prepare Supabase bucket:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`LMS API listening on ${env.HOST}:${env.PORT}`);
    for (const url of getNetworkUrls(env.PORT)) {
      console.log(`  → ${url}/api/v1`);
    }
  });

  function shutdown(signal: string) {
    console.log(`${signal} received. Shutting down...`);
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void start();