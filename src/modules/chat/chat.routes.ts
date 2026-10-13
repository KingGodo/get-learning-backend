import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as chatController from "./chat.controller.js";
import {
  messagesQuerySchema,
  openChatSchema,
  sendMessageSchema,
} from "./chat.schema.js";

const router = Router();

const chatRoles = [
  UserRole.TEACHER,
  UserRole.STUDENT,
  UserRole.PARENT,
  UserRole.HEADMASTER,
] as const;

router.use(authenticate, authorize(...chatRoles));

router.get("/", chatController.inbox);
router.post("/rooms", validate(openChatSchema), chatController.open);
router.get(
  "/rooms/:id/messages",
  validate(idParamSchema, "params"),
  validate(messagesQuerySchema, "query"),
  chatController.messages,
);
router.post(
  "/rooms/:id/messages",
  validate(idParamSchema, "params"),
  validate(sendMessageSchema),
  chatController.send,
);

export default router;
