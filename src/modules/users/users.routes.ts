import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as usersController from "./users.controller.js";
import {
  createStudentSchema,
  createTeacherSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./users.schema.js";

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN));

router.get("/", usersController.list);
router.post("/teachers", validate(createTeacherSchema), usersController.createTeacher);
router.post("/students", validate(createStudentSchema), usersController.createStudent);
router.get("/:id", validate(idParamSchema, "params"), usersController.getById);
router.post(
  "/:id/reset-credentials",
  validate(idParamSchema, "params"),
  usersController.resetCredentials,
);
router.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateUserSchema),
  usersController.update,
);
router.patch(
  "/:id/status",
  validate(idParamSchema, "params"),
  validate(updateUserStatusSchema),
  usersController.updateStatus,
);
router.delete("/:id", validate(idParamSchema, "params"), usersController.remove);

export default router;
