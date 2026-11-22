import { Router } from "express";
import { DuplicateDetectionController } from "./duplicate-detection.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";

const router = Router();

router.use(authenticateUser);

router.get("/:id/candidates", DuplicateDetectionController.getCandidates);
router.post("/:id/link", DuplicateDetectionController.linkDuplicate);

export const duplicateRoutes = router;
