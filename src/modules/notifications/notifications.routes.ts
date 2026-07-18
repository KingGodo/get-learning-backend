import { Router } from "express";
import { z } from "zod";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as notificationsController from "./notifications.controller.js";

const markReadSchema = z.object({
  ids: z.array(z.string().min(1)).optional(),
});

const deleteManySchema = z.object({
  ids: z.array(z.string().min(1)).optional(),
});

const router = Router();

router.use(authenticate);

router.get("/", notificationsController.list);
router.get("/unread-count", notificationsController.unreadCount);
router.post(
  "/read",
  validate(markReadSchema),
  notificationsController.markRead,
);
router.post(
  "/clear",
  validate(deleteManySchema),
  notificationsController.removeMany,
);
router.post(
  "/:id/read",
  validate(idParamSchema, "params"),
  notificationsController.markOne,
);
router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  notificationsController.removeOne,
);

export default router;
