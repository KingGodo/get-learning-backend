import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { clientIp, writeAuditLog } from "../../common/audit/audit.service.js";
import * as usersService from "./users.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.listUsers(req.user!.role, req.user!.schoolId, {
    role: typeof req.query.role === "string" ? req.query.role : undefined,
    q: typeof req.query.q === "string" ? req.query.q : undefined,
  });
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.getUserById(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.createTeacher(
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.user.schoolId ?? req.user!.schoolId,
    action: "USER.CREATE",
    entityType: "User",
    entityId: data.user.id,
    summary: `Created teacher ${data.user.email}`,
    metadata: { role: "TEACHER" },
    ip: clientIp(req),
  });
  res.status(201).json({ success: true, data });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.createStudent(
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.user.schoolId ?? req.user!.schoolId,
    action: "USER.CREATE",
    entityType: "User",
    entityId: data.user.id,
    summary: `Created student ${data.user.email}`,
    metadata: { role: "STUDENT" },
    ip: clientIp(req),
  });
  res.status(201).json({ success: true, data });
});

export const createHeadmaster = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.createHeadmaster(
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.user.schoolId ?? req.user!.schoolId,
    action: "USER.CREATE",
    entityType: "User",
    entityId: data.user.id,
    summary: `Created headmaster ${data.user.email}`,
    metadata: { role: "HEADMASTER" },
    ip: clientIp(req),
  });
  res.status(201).json({ success: true, data });
});

export const createParent = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.createParent(
    req.user!.role,
    req.user!.schoolId,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.user.schoolId ?? req.user!.schoolId,
    action: "USER.CREATE",
    entityType: "User",
    entityId: data.user.id,
    summary: `Created parent ${data.user.email}`,
    metadata: { role: "PARENT" },
    ip: clientIp(req),
  });
  res.status(201).json({ success: true, data });
});

export const resetCredentials = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.resetUserCredentials(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.user.schoolId ?? req.user!.schoolId,
    action: "USER.RESET_PASSWORD",
    entityType: "User",
    entityId: data.user.id,
    summary: `Reset password for ${data.user.email}`,
    ip: clientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.updateUserStatus(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.schoolId ?? req.user!.schoolId,
    action: "USER.STATUS",
    entityType: "User",
    entityId: data.id,
    summary: `Changed status for ${data.email} to ${data.status}`,
    metadata: { status: data.status },
    ip: clientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.updateUser(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
    req.body,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.schoolId ?? req.user!.schoolId,
    action: "USER.UPDATE",
    entityType: "User",
    entityId: data.id,
    summary: `Updated user ${data.email}`,
    ip: clientIp(req),
  });
  res.status(200).json({ success: true, data });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.deleteUser(
    req.user!.role,
    req.user!.schoolId,
    req.params.id as string,
  );
  await writeAuditLog({
    actorUserId: req.user!.userId,
    actorRole: req.user!.role,
    schoolId: data.schoolId ?? req.user!.schoolId,
    action: "USER.DELETE",
    entityType: "User",
    entityId: data.id,
    summary: `Deleted user ${data.email}`,
    ip: clientIp(req),
  });
  res.status(200).json({ success: true, data });
});
