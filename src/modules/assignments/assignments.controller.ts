import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as assignmentsService from "./assignments.service.js";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await assignmentsService.createAssignment(
    req.user!.userId,
    req.body,
    req.file,
  );
  res.status(201).json({ success: true, data });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
  const data = await assignmentsService.listAssignments(
    req.user!.userId,
    req.user!.role,
    classId,
  );
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await assignmentsService.getAssignment(
    req.user!.userId,
    req.user!.role,
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await assignmentsService.updateAssignment(
    req.user!.userId,
    String(req.params.id),
    req.body,
    req.file,
  );
  res.status(200).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await assignmentsService.deleteAssignment(
    req.user!.userId,
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});
