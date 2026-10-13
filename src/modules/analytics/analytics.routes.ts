import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as analyticsController from "./analytics.controller.js";
import { performanceReportQuerySchema } from "./analytics.schema.js";

const router = Router();

router.get(
  "/teacher",
  authenticate,
  authorize(UserRole.TEACHER),
  analyticsController.teacher,
);

router.get(
  "/reports",
  authenticate,
  authorize(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.HEADMASTER),
  validate(performanceReportQuerySchema, "query"),
  analyticsController.performance,
);

export default router;
