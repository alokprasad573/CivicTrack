import multer from "multer";
import { MAX_EVIDENCE_FILE_SIZE, MAX_EVIDENCE_COUNT } from "@civictrack/contracts";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_EVIDENCE_FILE_SIZE,
    files: MAX_EVIDENCE_COUNT,
  },
});

/**
 * Middleware supporting multipart/form-data for evidence images.
 * Accepts files under 'evidenceImages', 'images', or 'evidence'.
 */
export const uploadEvidenceMiddleware = upload.fields([
  { name: "evidenceImages", maxCount: MAX_EVIDENCE_COUNT },
  { name: "images", maxCount: MAX_EVIDENCE_COUNT },
  { name: "evidence", maxCount: MAX_EVIDENCE_COUNT },
]);
