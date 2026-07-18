import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as subjectsService from "./subjects.service.js";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const data = await subjectsService.listSubjects();
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.getSubject(String(req.params.id), {
    userId: req.user!.userId,
    role: req.user!.role,
  });
  res.status(200).json({ success: true, data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.createSubject(req.body);
  res.status(201).json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.updateSubject(String(req.params.id), req.body);
  res.status(200).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.deleteSubject(String(req.params.id));
  res.status(200).json({ success: true, data });
});
