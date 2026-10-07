import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import * as contactController from "./contact.controller.js";
import { createContactSchema } from "./contact.schema.js";

const router = Router();

router.post("/", validate(createContactSchema), contactController.create);

export default router;
