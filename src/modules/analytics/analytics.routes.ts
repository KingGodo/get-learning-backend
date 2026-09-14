import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import * as analyticsController from "./analytics.controller.js";

const router = Router();

router.get(
  "/teacher",
  authenticate,
  authorize(UserRole.TEACHER),
  analyticsController.teacher,
);

export default router;
