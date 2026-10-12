import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { clientIp, writeAuditLog } from "../../common/audit/audit.service.js";
import * as schoolsService from "./schools.service.js";

export const listSchools = asyncHandler(async (req: Request, res: Response) => {
  const data = await schoolsService.listSchools(req.user!.role);
  res.status(200).json({ success: true, data });
});

export const getMySchool = asyncHandler(async (req: Request, res: Response) => {
  const data = await schoolsService.getMySchool(req.user!.schoolId);
  res.status(200).json({ success: true, data });
});

export const createSchool = asyncHandler(async (req: Request, res: Response) => {
  const data = await schoolsService.createSchool(
    req.user!.userId,
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.school.id,
    action: "SCHOOL.CREATE",
    entityType: "School",
    entityId: data.school.id,
    summary: `Created school ${data.school.name}`,
    ip: clientIp(req),
  });
  res.status(201).json({ success: true, data });
});

export const updateMySchool = asyncHandler(async (req: Request, res: Response) => {
  const data = await schoolsService.updateMySchool(req.user!.schoolId, req.body);
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.id,
    action: "SCHOOL.UPDATE",
    entityType: "School",
    entityId: data.id,
    summary: `Updated school ${data.name}`,
    ip: clientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const getByCode = asyncHandler(async (req: Request, res: Response) => {
  const data = await schoolsService.getSchoolByCode(String(req.params.code));
  res.status(200).json({ success: true, data });
});

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: "Choose a logo image" });
    return;
  }

  const schoolId =
    req.params.id === undefined || req.params.id === "me"
      ? req.user!.schoolId
      : (req.params.id as string);

  if (!schoolId) {
    res.status(404).json({ success: false, message: "School not found" });
    return;
  }

  if (req.user!.role !== "ADMIN" && req.user!.schoolId !== schoolId) {
    res.status(403).json({
      success: false,
      message: "You do not have permission to update this school",
    });
    return;
  }

  const data = await schoolsService.setSchoolLogo(schoolId, req.file);
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.id,
    action: "SCHOOL.UPDATE",
    entityType: "School",
    entityId: data.id,
    summary: `Updated logo for ${data.name}`,
    ip: clientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await schoolsService.getSchoolById(
    req.user!.role,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});
