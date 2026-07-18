import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as submissionsService from "./submissions.service.js";

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const data = await submissionsService.submitAssignment(
    req.user!.userId,
    req.body,
    req.file,
  );
  res.status(201).json({ success: true, data });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const assignmentId =
    typeof req.query.assignmentId === "string" ? req.query.assignmentId : undefined;
  const data = await submissionsService.listSubmissions(
    req.user!.userId,
    req.user!.role,
    assignmentId,
  );
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await submissionsService.getSubmission(
    req.user!.userId,
    req.user!.role,
    String(req.params.id),
  );
  res.status(200).json({ success: true, data });
});

export const grade = asyncHandler(async (req: Request, res: Response) => {
  const data = await submissionsService.gradeSubmission(
    req.user!.userId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ success: true, data });
});
