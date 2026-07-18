import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as usersService from "./users.service.js";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.listUsers(req.user!.role, {
    role: typeof req.query.role === "string" ? req.query.role : undefined,
    q: typeof req.query.q === "string" ? req.query.q : undefined,
  });
  res.status(200).json({ success: true, data });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await usersService.getUserById(
    req.user!.role,
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});
