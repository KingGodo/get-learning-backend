import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import materialsRoutes from "../materials/materials.routes.js";
import * as classesController from "./classes.controller.js";
import {
  createClassSchema,
  joinClassSchema,
  updateClassSchema,
} from "./classes.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", classesController.listMine);

router.post(
  "/",
  authorize(UserRole.SCHOOL_ADMIN, UserRole.ADMIN),
  validate(createClassSchema),
  classesController.create,
);

router.post(
  "/join",
  authorize(UserRole.STUDENT),
  validate(joinClassSchema),
  classesController.join,
);

router.use("/:classId/materials", materialsRoutes);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  classesController.getById,
);

router.patch(
  "/:id",
  authorize(UserRole.SCHOOL_ADMIN, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  validate(updateClassSchema),
  classesController.update,
);

router.delete(
  "/:id",
  authorize(UserRole.SCHOOL_ADMIN, UserRole.ADMIN),
  validate(idParamSchema, "params"),
  classesController.remove,
);

export default router;
