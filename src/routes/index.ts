import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import schoolsRoutes from "../modules/schools/schools.routes.js";
import subjectsRoutes from "../modules/subjects/subjects.routes.js";
import classesRoutes from "../modules/classes/classes.routes.js";
import assignmentsRoutes from "../modules/assignments/assignments.routes.js";
import submissionsRoutes from "../modules/submissions/submissions.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import filesRoutes from "../modules/files/files.routes.js";
import notificationsRoutes from "../modules/notifications/notifications.routes.js";
import usersRoutes from "../modules/users/users.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "LMS API is running" });
});

router.use("/auth", authRoutes);
router.use("/schools", schoolsRoutes);
router.use("/subjects", subjectsRoutes);
router.use("/classes", classesRoutes);
router.use("/assignments", assignmentsRoutes);
router.use("/submissions", submissionsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/files", filesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/users", usersRoutes);

export default router;
