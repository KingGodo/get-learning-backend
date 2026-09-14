import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as auditService from "./audit.service.js";
import type { ListAuditQuery } from "./audit.schema.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await auditService.listAuditLogs(
    req.user!.role,
    req.user!.schoolId,
    req.query as unknown as ListAuditQuery,
  );
  res.status(200).json({ success: true, data });
});
