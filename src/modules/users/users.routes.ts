import { Router } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { idParamSchema } from "../../common/validation/schemas.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as usersController from "./users.controller.js";

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN));

router.get("/", usersController.list);
router.get("/:id", validate(idParamSchema, "params"), usersController.getById);

export default router;
