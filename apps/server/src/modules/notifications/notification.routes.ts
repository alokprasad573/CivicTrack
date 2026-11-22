import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";

const router = Router();

// All notification operations require authenticated user context
router.use(authenticateUser);

router.get("/", NotificationController.list);
router.patch("/:id/read", NotificationController.markRead);
router.post("/read-all", NotificationController.markAllRead);

export const notificationRoutes = router;
