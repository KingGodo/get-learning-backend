import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as analyticsService from "./analytics.service.js";

export const teacher = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getTeacherAnalytics(
    req.user!.userId,
    req.user!.role,
  );
  res.status(200).json({ success: true, data });
});
