import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as materialsService from "./materials.service.js";

function authContext(req: Request) {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    schoolId: req.user!.schoolId,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await materialsService.listMaterials(
    authContext(req),
    String(req.params.classId),
  );
  res.status(200).json({ success: true, data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const files = Array.isArray(req.files)
    ? (req.files as Express.Multer.File[])
    : [];
  const data = await materialsService.createMaterials(
    authContext(req),
    String(req.params.classId),
    req.body,
    files,
  );
  res.status(201).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await materialsService.deleteMaterial(
    authContext(req),
    String(req.params.classId),
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});
