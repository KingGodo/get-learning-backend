import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as authController from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerStudentSchema,
  registerTeacherSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./auth.schema.js";

const router = Router();

router.get("/register/schools", authController.listRegistrationSchools);

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

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword,
);

router.get("/me", authenticate, authController.me);

router.patch(
  "/me",
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile,
);

export default router;
