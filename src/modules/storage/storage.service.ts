import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getSupabase, isSupabaseConfigured } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, "../../../uploads");

let bucketReady: Promise<void> | null = null;

function publicFileUrl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (env.PUBLIC_APP_URL) {
    return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/uploads/${normalized}`;
  }
  return `/uploads/${normalized}`;
}

/** Ensure the configured Supabase bucket exists and is public. */
export async function ensureStorageBucket(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = getSupabase();
      const bucket = env.SUPABASE_STORAGE_BUCKET;

      const { data: buckets, error: listError } =
        await supabase.storage.listBuckets();
      if (listError) {
        throw new AppError(
          `Could not list storage buckets: ${listError.message}`,
          500,
        );
      }

      const existing = buckets?.find((b) => b.name === bucket);
      if (!existing) {
        const { error } = await supabase.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 25 * 1024 * 1024,
          allowedMimeTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
        });
        if (error) {
          throw new AppError(
            `Could not create storage bucket "${bucket}": ${error.message}. Create it in the Supabase dashboard (Storage → New bucket → Public).`,
            500,
          );
        }
        return;
      }

      if (!existing.public) {
        const { error } = await supabase.storage.updateBucket(bucket, {
          public: true,
        });
        if (error) {
          console.warn(
            `[storage] Bucket "${bucket}" is private and could not be updated (${error.message}). Preview/download will use signed URLs.`,
          );
        }
      }
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }

  await bucketReady;
}

export function parseSupabaseObjectUrl(
  url: string,
): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)/,
    );
    if (!match?.[1] || !match[2]) return null;
    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

/** Short-lived URL that works even if the bucket is private. */
export async function createAccessibleFileUrl(
  storedUrl: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  if (!storedUrl) {
    throw new AppError("File URL is required", 400);
  }

  if (!/^https?:\/\//i.test(storedUrl) && storedUrl.startsWith("/uploads/")) {
    const base = env.PUBLIC_APP_URL?.replace(/\/$/, "") || "";
    return base ? `${base}${storedUrl}` : storedUrl;
  }

  const object = parseSupabaseObjectUrl(storedUrl);
  if (!object) {
    return storedUrl;
  }

  if (!isSupabaseConfigured()) {
    return storedUrl;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(object.bucket)
    .createSignedUrl(object.path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new AppError(
      error?.message === "Bucket not found"
        ? `Storage bucket "${object.bucket}" was not found. Create a public bucket named "${env.SUPABASE_STORAGE_BUCKET}" in Supabase Storage, or set SUPABASE_STORAGE_BUCKET to your existing bucket name.`
        : `Could not create file link: ${error?.message ?? "unknown error"}`,
      404,
    );
  }

  return data.signedUrl;
}

export async function uploadFile(
  folder: string,
  file: Express.Multer.File,
): Promise<string> {
  if (isSupabaseConfigured()) {
    return uploadToSupabase(folder, file);
  }

  return uploadLocally(folder, file);
}

async function uploadToSupabase(
  folder: string,
  file: Express.Multer.File,
): Promise<string> {
  await ensureStorageBucket();

  const supabase = getSupabase();
  const extension = file.originalname.split(".").pop() ?? "bin";
  const storagePath = `${folder}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new AppError(
        `Storage bucket "${env.SUPABASE_STORAGE_BUCKET}" not found. Create it in Supabase (Storage → New bucket, name: ${env.SUPABASE_STORAGE_BUCKET}, Public: on), or set SUPABASE_STORAGE_BUCKET in .env to your bucket name.`,
        500,
      );
    }
    throw new AppError(`File upload failed: ${error.message}`, 500);
  }

  const { data } = supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

async function uploadLocally(
  folder: string,
  file: Express.Multer.File,
): Promise<string> {
  const extension = file.originalname.split(".").pop() ?? "bin";
  const filename = `${randomUUID()}.${filenameSafe(extension)}`;
  const folderPath = path.join(UPLOADS_ROOT, folder);
  await mkdir(folderPath, { recursive: true });
  await writeFile(path.join(folderPath, filename), file.buffer);
  return publicFileUrl(`${folder}/${filename}`);
}

function filenameSafe(extension: string) {
  return extension.replace(/[^a-zA-Z0-9]/g, "") || "bin";
}

/** Read a stored file (local disk or Supabase) for proxying. */
export async function readStoredFile(storedUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
  filename: string;
}> {
  const object = parseSupabaseObjectUrl(storedUrl);
  if (object && isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(object.bucket)
      .download(object.path);
    if (error || !data) {
      throw new AppError(
        error?.message ?? "Could not download file from storage",
        404,
      );
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const filename = object.path.split("/").pop() ?? "file";
    return {
      buffer,
      contentType: data.type || "application/octet-stream",
      filename,
    };
  }

  const relative = storedUrl.replace(/^\/uploads\//, "").replace(/^.*\/uploads\//, "");
  const absolute = path.join(UPLOADS_ROOT, relative);
  if (!absolute.startsWith(UPLOADS_ROOT)) {
    throw new AppError("Invalid file path", 400);
  }
  const buffer = await readFile(absolute);
  return {
    buffer,
    contentType: "application/octet-stream",
    filename: path.basename(absolute),
  };
}
