import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as usersController from "./users.controller.js";
import {
  createHeadmasterSchema,
  createParentSchema,
  createStudentSchema,
  createTeacherSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./users.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN, UserRole.HEADMASTER), usersController.list);
router.post(
  "/teachers",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(createTeacherSchema),
  usersController.createTeacher,
);
router.post(
  "/students",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(createStudentSchema),
  usersController.createStudent,
);
router.post(
  "/headmasters",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(createHeadmasterSchema),
  usersController.createHeadmaster,
);
router.post(
  "/parents",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(createParentSchema),
  usersController.createParent,
);
router.get(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN, UserRole.HEADMASTER),
  validate(idParamSchema, "params"),
  usersController.getById,
);
router.post(
  "/:id/reset-credentials",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(idParamSchema, "params"),
  usersController.resetCredentials,
);
router.patch(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(idParamSchema, "params"),
  validate(updateUserSchema),
  usersController.update,
);
router.patch(
  "/:id/status",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(idParamSchema, "params"),
  validate(updateUserStatusSchema),
  usersController.updateStatus,
);
router.delete(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(idParamSchema, "params"),
  usersController.remove,
);

export default router;
