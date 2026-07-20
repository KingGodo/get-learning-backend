import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as subjectsController from "./subjects.controller.js";
import { createSubjectSchema, updateSubjectSchema } from "./subjects.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", subjectsController.list);

router.get(
  "/school-catalog",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  subjectsController.schoolCatalog,
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  subjectsController.getById,
);

router.post(
  "/",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(createSubjectSchema),
  subjectsController.create,
);

router.post(
  "/:id/assign",
  authorize(UserRole.TEACHER),
  validate(idParamSchema, "params"),
  subjectsController.assign,
);

router.delete(
  "/:id/assign",
  authorize(UserRole.TEACHER),
  validate(idParamSchema, "params"),
  subjectsController.unassign,
);

router.patch(
  "/:id",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  validate(updateSubjectSchema),
  subjectsController.update,
);

router.delete(
  "/:id",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  subjectsController.remove,
);

export default router;
