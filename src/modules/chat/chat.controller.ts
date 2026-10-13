import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import type { OpenChatInput } from "./chat.schema.js";
import * as chatService from "./chat.service.js";

function ctx(req: Request) {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    schoolId: req.user!.schoolId,
  };
}

export const inbox = asyncHandler(async (req: Request, res: Response) => {
  const data = await chatService.getInbox(ctx(req));
  res.status(200).json({ success: true, data });
});

export const open = asyncHandler(async (req: Request, res: Response) => {
  const data = await chatService.openRoom(ctx(req), req.body as OpenChatInput);
  res.status(200).json({ success: true, data });
});

export const messages = asyncHandler(async (req: Request, res: Response) => {
  const after = typeof req.query.after === "string" ? req.query.after : undefined;
  const data = await chatService.listMessages(ctx(req), String(req.params.id), after);
  res.status(200).json({ success: true, data });
});

export const send = asyncHandler(async (req: Request, res: Response) => {
  const data = await chatService.sendMessage(
    ctx(req),
    String(req.params.id),
    req.body.body as string,
  );
  res.status(201).json({ success: true, data });
});
