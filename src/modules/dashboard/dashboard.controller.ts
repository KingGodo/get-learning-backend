import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as dashboardService from "./dashboard.service.js";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getDashboard(req.user!.userId, req.user!.role);
  res.status(200).json({ success: true, data });
});
