import multer from "multer";
import { AppError } from "../common/errors/AppError.js";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.memoryStorage();

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError("Logo must be a JPEG, PNG, or WebP image", 400));
      return;
    }
    cb(null, true);
  },
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError("Only PDF and Word documents are allowed", 400));
      return;
    }
    cb(null, true);
  },
});
