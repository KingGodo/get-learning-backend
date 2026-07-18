import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as notificationsService from "./notifications.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationsService.listNotifications(req.user!.userId);
  res.status(200).json({ success: true, data });
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationsService.getUnreadCount(req.user!.userId);
  res.status(200).json({ success: true, data });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
  const data = await notificationsService.markNotificationsRead(
    req.user!.userId,
    ids,
  );
  res.status(200).json({ success: true, data });
});

export const markOne = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationsService.markOneRead(
    req.user!.userId,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});

export const removeOne = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationsService.deleteNotification(
    req.user!.userId,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});

export const removeMany = asyncHandler(async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
  const data = await notificationsService.deleteNotifications(
    req.user!.userId,
    ids,
  );
  res.status(200).json({ success: true, data });
});
