import app from "./app.js";
import { env } from "./config/env.js";
import { isSupabaseConfigured } from "./config/supabase.js";
import { ensureStorageBucket } from "./modules/storage/storage.service.js";

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

  const server = app.listen(env.PORT, () => {
    console.log(`LMS API listening on http://localhost:${env.PORT}`);
  });

  function shutdown(signal: string) {
    console.log(`${signal} received. Shutting down...`);
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void start();