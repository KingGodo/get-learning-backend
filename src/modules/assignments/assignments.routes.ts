import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import {
  classIdQuerySchema,
  idParamSchema,
} from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { uploadDocument } from "../../middlewares/upload.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as assignmentsController from "./assignments.controller.js";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from "./assignments.schema.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  validate(classIdQuerySchema, "query"),
  assignmentsController.list,
);

router.post(
  "/",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  uploadDocument.single("attachment"),
  validate(createAssignmentSchema),
  assignmentsController.create,
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  assignmentsController.getById,
);

router.patch(
  "/:id",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  uploadDocument.single("attachment"),
  validate(updateAssignmentSchema),
  assignmentsController.update,
);

router.delete(
  "/:id",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  assignmentsController.remove,
);

export default router;
