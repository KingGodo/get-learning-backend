import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as authService from "./auth.service.js";

export const registerTeacher = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.registerTeacher(req.body);
  res.status(201).json({ success: true, data });
});

export const listRegistrationSchools = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await authService.listSchoolsForRegistration();
    res.status(200).json({ success: true, data });
  },
);

export const registerStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.registerStudent(req.body);
  res.status(201).json({ success: true, data });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.login(req.body);
  res.status(200).json({ success: true, data });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.getMe(req.user!.userId);
  res.status(200).json({ success: true, data });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.updateProfile(req.user!.userId, req.body);
  res.status(200).json({ success: true, data });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.changePassword(req.user!.userId, req.body);
  res.status(200).json({ success: true, data });
});

export const changeEmail = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.changeEmail(req.user!.userId, req.body);
  res.status(200).json({ success: true, data });
});

export const verifyCurrentPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await authService.verifyCurrentPassword(req.user!.userId, req.body);
    res.status(200).json({ success: true, data });
  },
);

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.forgotPassword(req.body);
  res.status(200).json({ success: true, data });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.resetPassword(req.body);
  res.status(200).json({ success: true, data });
});
