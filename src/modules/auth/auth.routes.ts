import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as authController from "./auth.controller.js";
import {
  loginSchema,
  registerStudentSchema,
  registerTeacherSchema,
  updateProfileSchema,
} from "./auth.schema.js";

const router = Router();

router.post(
  "/register/teacher",
  validate(registerTeacherSchema),
  authController.registerTeacher,
);

router.post(
  "/register/student",
  validate(registerStudentSchema),
  authController.registerStudent,
);

router.post("/login", validate(loginSchema), authController.login);

router.get("/me", authenticate, authController.me);

router.patch(
  "/me",
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile,
);

export default router;
