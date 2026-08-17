import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createAccessibleFileUrl,
  readStoredFile,
} from "../storage/storage.service.js";

const router = Router();

const accessSchema = z.object({
  url: z.string().min(1, "url is required"),
  mode: z.enum(["preview", "download"]).optional(),
});

/** Returns a short-lived signed URL for Preview / Download. */
router.post(
  "/signed",
  authenticate,
  validate(accessSchema),
  asyncHandler(async (req, res) => {
    const signedUrl = await createAccessibleFileUrl(req.body.url, 60 * 60, {
      download: req.body.mode === "download",
    });
    res.status(200).json({
      success: true,
      data: { url: signedUrl },
    });
  }),
);

/** Streams the file through the API (works when public URLs 404). */
router.get(
  "/download",
  authenticate,
  asyncHandler(async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url) {
      res.status(400).json({
        success: false,
        message: "url query parameter is required",
      });
      return;
    }

    const file = await readStoredFile(url);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename.replace(/"/g, "")}"`,
    );
    res.send(file.buffer);
  }),
);

export default router;
