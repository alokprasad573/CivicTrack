import { Router } from "express";
import { ComplaintController } from "./complaint.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";
import { requireRole } from "../identity/rbac.middleware.js";
import { uploadEvidenceMiddleware } from "../../common/middleware/upload.middleware.js";
import { UserRole } from "@civictrack/contracts";

const router = Router();

// Spatial nearby query (can be accessed to preview nearby public issues)
router.get("/nearby", ComplaintController.findNearby);

// Complaint creation (authenticated citizen, supports multipart/form-data evidence files)
router.post("/", authenticateUser, uploadEvidenceMiddleware, ComplaintController.create);

// Scoped listing (citizen view own, officer view assigned, admin view all)
router.get("/", authenticateUser, ComplaintController.list);

// Detailed view with object-level authorization & status timeline
router.get("/:id", authenticateUser, ComplaintController.getById);

// Submit citizen resolution feedback and close complaint
router.post("/:id/feedback", authenticateUser, ComplaintController.submitFeedback);

// Administrative operations
router.post("/:id/review", authenticateUser, requireRole(UserRole.ADMIN), ComplaintController.review);
router.post("/:id/verify", authenticateUser, requireRole(UserRole.ADMIN), ComplaintController.verify);
router.post("/:id/reject", authenticateUser, requireRole(UserRole.ADMIN), ComplaintController.reject);
router.post("/:id/assign", authenticateUser, requireRole(UserRole.ADMIN), ComplaintController.assign);

// Officer workflow operations
router.post("/:id/start-work", authenticateUser, ComplaintController.startWork);
router.post("/:id/resolve", authenticateUser, ComplaintController.resolve);

export const complaintRoutes = router;
