import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as authController from "./auth.controller.js";
import {
  changeEmailSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyPasswordSchema,
} from "./auth.schema.js";

const router = Router();

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

router.patch(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

router.patch(
  "/change-email",
  authenticate,
  validate(changeEmailSchema),
  authController.changeEmail,
);

router.post(
  "/verify-password",
  authenticate,
  validate(verifyPasswordSchema),
  authController.verifyCurrentPassword,
);

export default router;
