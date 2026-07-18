import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as classesService from "./classes.service.js";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.createClass(
    req.user!.userId,
    req.user!.schoolId,
    req.body,
  );
  res.status(201).json({ success: true, data });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.listMyClasses(req.user!.userId, req.user!.role);
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.getClassById(
    req.user!.userId,
    req.user!.role,
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.updateClass(
    req.user!.userId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.deleteClass(req.user!.userId, String(req.params.id));
  res.status(200).json({ success: true, data });
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.joinClass(req.user!.userId, req.body);
  res.status(200).json({ success: true, data });
});
