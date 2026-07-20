import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as subjectsService from "./subjects.service.js";

function authContext(req: Request) {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    schoolId: req.user!.schoolId,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.listSubjects(authContext(req));
  res.status(200).json({ success: true, data });
});

export const schoolCatalog = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.listSchoolCatalog(authContext(req));
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.getSubject(String(req.params.id), {
    userId: req.user!.userId,
    role: req.user!.role,
    schoolId: req.user!.schoolId,
  });
  res.status(200).json({ success: true, data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.createSubject(authContext(req), req.body);
  res.status(201).json({ success: true, data });
});

export const assign = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.assignSubject(
    authContext(req),
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const unassign = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.unassignSubject(
    authContext(req),
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.updateSubject(
    authContext(req),
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await subjectsService.deleteSubject(
    authContext(req),
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});
