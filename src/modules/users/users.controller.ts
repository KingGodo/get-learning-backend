import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as usersService from "./users.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.listUsers(req.user!.role, req.user!.schoolId, {
    role: typeof req.query.role === "string" ? req.query.role : undefined,
    q: typeof req.query.q === "string" ? req.query.q : undefined,
  });
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.getUserById(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.createTeacher(
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  res.status(201).json({ success: true, data });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.createStudent(
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  res.status(201).json({ success: true, data });
});

export const resetCredentials = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.resetUserCredentials(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.updateUserStatus(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
    req.body,
  );
  res.status(200).json({ success: true, data });
});
