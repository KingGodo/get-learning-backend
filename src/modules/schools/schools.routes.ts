import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import {
  idParamSchema,
  schoolCodeParamSchema,
} from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as schoolsController from "./schools.controller.js";
import { createSchoolSchema, updateSchoolSchema } from "./schools.schema.js";

const router = Router();

router.get(
  "/code/:code",
  validate(schoolCodeParamSchema, "params"),
  schoolsController.getByCode,
);

router.get(
  "/",
  authenticate,
  authorize(UserRole.ADMIN),
  schoolsController.listSchools,
);

router.get(
  "/me",
  authenticate,
  authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  schoolsController.getMySchool,
);

router.get(
  "/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(idParamSchema, "params"),
  schoolsController.getById,
);

router.post(
  "/",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(createSchoolSchema),
  schoolsController.createSchool,
);

router.patch(
  "/me",
  authenticate,
  authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.SCHOOL_ADMIN),
  validate(updateSchoolSchema),
  schoolsController.updateMySchool,
);

export default router;
