import multer from "multer";
import { MAX_EVIDENCE_FILE_SIZE, MAX_EVIDENCE_COUNT } from "@civictrack/contracts";
import { ValidationError } from "../errors/app-error.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_EVIDENCE_FILE_SIZE,
    files: MAX_EVIDENCE_COUNT,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError(`Unsupported file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP.`));
    } else {
      cb(null, true);
    }
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
  { name: "resolutionImages", maxCount: MAX_EVIDENCE_COUNT },
  { name: "resolutionEvidence", maxCount: MAX_EVIDENCE_COUNT },
]);
