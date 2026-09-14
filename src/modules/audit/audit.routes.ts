import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as auditController from "./audit.controller.js";
import { listAuditQuerySchema } from "./audit.schema.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN, UserRole.HEADMASTER),
  validate(listAuditQuerySchema, "query"),
  auditController.list,
);

export default router;
