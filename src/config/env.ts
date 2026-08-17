import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  /** Bind address. Use 0.0.0.0 to accept connections from other devices on the LAN. */
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  /** Absolute API origin for local file URLs, e.g. http://localhost:4000 */
  PUBLIC_APP_URL: z.string().optional().default(""),
  /** Frontend origin for password-reset links, e.g. http://localhost:3000 */
  FRONTEND_URL: z.string().optional().default("http://localhost:3000"),
  /** Extra CORS origins (comma-separated), e.g. https://www.example.com */
  CORS_ORIGINS: z.string().optional().default(""),
  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("lms-files"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
