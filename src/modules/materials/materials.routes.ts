import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { uploadDocument } from "../../middlewares/upload.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as materialsController from "./materials.controller.js";
import {
  classIdParamSchema,
  createMaterialsSchema,
  materialIdParamSchema,
} from "./materials.schema.js";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get(
  "/",
  validate(classIdParamSchema, "params"),
  materialsController.list,
);

router.post(
  "/",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  uploadDocument.array("attachments", 20),
  validate(classIdParamSchema, "params"),
  validate(createMaterialsSchema),
  materialsController.create,
);

router.delete(
  "/:id",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(materialIdParamSchema, "params"),
  materialsController.remove,
);

export default router;
