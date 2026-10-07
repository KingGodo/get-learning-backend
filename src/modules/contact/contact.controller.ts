import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import * as contactService from "./contact.service.js";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await contactService.createContactMessage(req.body);
  res.status(201).json({ success: true, data });
});
