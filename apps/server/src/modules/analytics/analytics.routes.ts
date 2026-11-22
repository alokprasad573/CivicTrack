import { Router } from "express";
import { AnalyticsController } from "./analytics.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";

const router = Router();

router.use(authenticateUser);

router.get("/summary", AnalyticsController.getSummary);

export const analyticsRoutes = router;
