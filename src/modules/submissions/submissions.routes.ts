import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import {
  assignmentIdQuerySchema,
  idParamSchema,
} from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { uploadDocument } from "../../middlewares/upload.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as submissionsController from "./submissions.controller.js";
import {
  gradeSubmissionSchema,
  submitAssignmentSchema,
} from "./submissions.schema.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  validate(assignmentIdQuerySchema, "query"),
  submissionsController.list,
);

router.post(
  "/",
  authorize(UserRole.STUDENT),
  uploadDocument.single("attachment"),
  validate(submitAssignmentSchema),
  submissionsController.submit,
);

router.patch(
  "/:id/grade",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  validate(gradeSubmissionSchema),
  submissionsController.grade,
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  submissionsController.getById,
);

export default router;
