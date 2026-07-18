import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import * as dashboardController from "./dashboard.controller.js";

const router = Router();

router.get("/", authenticate, dashboardController.getDashboard);

export default router;
