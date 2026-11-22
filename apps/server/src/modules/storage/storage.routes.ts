import { Router } from "express";
import { UserRole } from "@civictrack/contracts";
import { StorageController } from "./storage.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";
import { requireRole } from "../identity/rbac.middleware.js";
import { uploadEvidenceMiddleware } from "../../common/middleware/upload.middleware.js";

const router = Router();

// Direct multipart/form-data evidence image upload (authenticated users)
router.post("/upload", authenticateUser, uploadEvidenceMiddleware, StorageController.uploadFiles);

// Upload Intent (authenticated users)
router.post("/upload-intent", authenticateUser, StorageController.createUploadIntent);
router.post("/upload-intents", authenticateUser, StorageController.createUploadIntent);

// View pre-signed URL (authenticated, object-level authorized)
router.get("/view-url", authenticateUser, StorageController.getViewUrl);

// Orphan cleanup routine (admin-only)
router.post(
  "/cleanup",
  authenticateUser,
  requireRole(UserRole.ADMIN),
  StorageController.cleanupOrphans
);

export const storageRoutes = router;
