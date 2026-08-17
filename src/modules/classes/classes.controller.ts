import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as classesService from "./classes.service.js";

function authContext(req: Request) {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    schoolId: req.user!.schoolId,
  };
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.createClass(authContext(req), req.body);
  res.status(201).json({ success: true, data });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.listMyClasses(authContext(req));
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.getClassById(
    authContext(req),
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.updateClass(
    authContext(req),
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.deleteClass(
    authContext(req),
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  const data = await classesService.joinClass(req.user!.userId, req.body);
  res.status(200).json({ success: true, data });
});
