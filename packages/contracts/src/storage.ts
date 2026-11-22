import { z } from "zod";

/**
 * Allowed Evidence MIME types for civic complaints and resolution proof
 * Strictly restricted to standard raster web images.
 * Scalable Vector Graphics (SVG), executable binaries, and document files are strictly prohibited.
 */
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedEvidenceMimeType = (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number];

export const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10 Megabytes
export const MAX_EVIDENCE_COUNT = 5; // Maximum 5 evidence images per complaint

/**
 * Schema for individual file declared in upload intent
 */
export const UploadIntentFileSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required").max(255, "Filename too long"),
  contentType: z.enum(ALLOWED_EVIDENCE_MIME_TYPES, {
    errorMap: () => ({
      message: "Unsupported file type. Only JPEG, PNG, and WebP images are permitted.",
    }),
  }),
  size: z
    .number()
    .int("File size must be an integer")
    .positive("File size must be greater than 0")
    .max(MAX_EVIDENCE_FILE_SIZE, "File size cannot exceed 10MB"),
  checksum: z.string().optional(),
});

export type UploadIntentFile = z.infer<typeof UploadIntentFileSchema>;

/**
 * Schema for requesting pre-signed S3 upload URLs
 */
export const CreateUploadIntentSchema = z.object({
  files: z
    .array(UploadIntentFileSchema)
    .min(1, "At least one file must be declared")
    .max(MAX_EVIDENCE_COUNT, `Maximum of ${MAX_EVIDENCE_COUNT} files allowed per request`),
});

export type CreateUploadIntentDto = z.infer<typeof CreateUploadIntentSchema>;

/**
 * Pre-signed S3 upload descriptor returned to client
 */
export interface PresignedUploadItem {
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface UploadIntentResponse {
  uploads: PresignedUploadItem[];
}

/**
 * Query schema for requesting a short-lived view URL for private S3 evidence
 */
export const ViewUrlQuerySchema = z.object({
  objectKey: z.string().trim().min(1, "objectKey is required"),
});

export type ViewUrlQuery = z.infer<typeof ViewUrlQuerySchema>;

export interface ViewUrlResponse {
  objectKey: string;
  viewUrl: string;
  expiresInSeconds: number;
}
