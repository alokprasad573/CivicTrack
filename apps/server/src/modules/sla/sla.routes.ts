import { Router } from "express";
import { SlaController } from "./sla.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";

const router = Router();

router.use(authenticateUser);

router.post("/scan", SlaController.triggerScan);
router.get("/overdue", SlaController.listOverdue);

export const slaRoutes = router;
