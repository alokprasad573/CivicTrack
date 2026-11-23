import crypto from "node:crypto";
import { Types } from "mongoose";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE,
  EvidenceItem,
} from "@civictrack/contracts";
import {
  getS3Client,
  getS3BucketName,
  PRESIGNED_UPLOAD_EXPIRY_SECONDS,
  PRESIGNED_VIEW_EXPIRY_SECONDS,
} from "../../config/s3.js";
import { UploadIntentModel } from "./upload-intent.model.js";
import { ValidationError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class S3Service {
  /**
   * Validate image file size, declared MIME type, and binary magic bytes
   */
  public static validateImage(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    size: number
  ): { extension: string; mimeType: string } {
    if (!buffer || buffer.length === 0 || size <= 0) {
      throw new ValidationError(`Evidence file '${originalName}' is empty.`);
    }

    if (size > MAX_EVIDENCE_FILE_SIZE) {
      throw new ValidationError(
        `File '${originalName}' exceeds the maximum allowed size of 10MB (${(size / (1024 * 1024)).toFixed(1)}MB).`
      );
    }

    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mimeType as any)) {
      throw new ValidationError(
        `File '${originalName}' has unsupported MIME type '${mimeType}'. Only JPEG, PNG, and WebP are allowed.`
      );
    }

    // Verify file magic bytes signature
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    const isWebP =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP";

    let detectedMime: string | null = null;
    if (isJpeg) detectedMime = "image/jpeg";
    else if (isPng) detectedMime = "image/png";
    else if (isWebP) detectedMime = "image/webp";

    if (!detectedMime) {
      throw new ValidationError(
        `File '${originalName}' contains invalid or corrupted image binary data (signature mismatch).`
      );
    }

    const extension = MIME_EXTENSION_MAP[detectedMime] || "jpg";
    return { extension, mimeType: detectedMime };
  }

  /**
   * Generate canonical, unpredictable S3 object key:
   * Incident proof: complaints/{userId}/{complaintId}/{uuid}.{extension}
   * Resolution proof: resolved/image/{complaintId}/{uuid}.{extension}
   */
  public static generateObjectKey(params: {
    userId: string;
    complaintId: string;
    extension: string;
    folder?: string;
  }): string {
    const { userId, complaintId, extension, folder } = params;
    const uuid = crypto.randomUUID();
    if (folder === "resolved" || folder === "resolved/image") {
      return `resolved/image/${complaintId}/${uuid}.${extension}`;
    }
    return `complaints/${userId}/${complaintId}/${uuid}.${extension}`;
  }

  /**
   * Upload an image buffer directly to the configured AWS S3 bucket
   */
  public static async uploadImage(params: {
    buffer: Buffer;
    objectKey: string;
    contentType: string;
  }): Promise<void> {
    const { buffer, objectKey, contentType } = params;
    const s3Client = getS3Client();
    const bucketName = getS3BucketName();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    logger.info("Successfully uploaded evidence image to AWS S3", {
      bucket: bucketName,
      key: objectKey,
      contentType,
      sizeBytes: buffer.length,
    });
  }

  /**
   * Generate an authorized pre-signed GET URL for viewing private S3 evidence
   */
  public static async generatePresignedViewUrl(
    objectKey: string,
    expiresInSeconds = PRESIGNED_VIEW_EXPIRY_SECONDS
  ): Promise<string> {
    const s3Client = getS3Client();
    const bucketName = getS3BucketName();

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Delete uploaded objects from S3 (used for rollbacks when MongoDB persistence fails)
   */
  public static async deleteObjects(objectKeys: string[]): Promise<void> {
    if (!objectKeys || objectKeys.length === 0) return;

    const s3Client = getS3Client();
    const bucketName = getS3BucketName();

    for (const key of objectKeys) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
          })
        );
        logger.info("Deleted S3 object (rollback/cleanup)", { bucket: bucketName, key });
      } catch (err) {
        logger.error("Failed to delete S3 object during rollback", {
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Process multiple multipart files, validate each, upload to AWS S3, and return complete EvidenceItem descriptors
   */
  public static async processAndUploadEvidenceFiles(params: {
    files: Express.Multer.File[];
    userId: string;
    complaintId: string;
    folder?: string;
  }): Promise<EvidenceItem[]> {
    const { files, userId, complaintId, folder } = params;
    if (!files || files.length === 0) return [];

    const validatedItems: Array<{
      buffer: Buffer;
      originalName: string;
      contentType: string;
      size: number;
      objectKey: string;
    }> = [];

    // Step 1: Pre-validate all files before initiating S3 network uploads
    for (const file of files) {
      const { extension, mimeType } = this.validateImage(
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size
      );

      const objectKey = this.generateObjectKey({
        userId,
        complaintId,
        extension,
        folder,
      });

      validatedItems.push({
        buffer: file.buffer,
        originalName: file.originalname,
        contentType: mimeType,
        size: file.size,
        objectKey,
      });
    }

    // Step 2: Upload each file to AWS S3
    const uploadedKeys: string[] = [];
    const evidenceResults: EvidenceItem[] = [];

    try {
      for (const item of validatedItems) {
        await this.uploadImage({
          buffer: item.buffer,
          objectKey: item.objectKey,
          contentType: item.contentType,
        });

        uploadedKeys.push(item.objectKey);

        // Register upload intent in MongoDB if DB is connected so it can be validated and attached
        if (UploadIntentModel.db.readyState === 1) {
          const userObjId = Types.ObjectId.isValid(userId)
            ? new Types.ObjectId(userId)
            : new Types.ObjectId();
          await UploadIntentModel.create({
            objectKey: item.objectKey,
            userId: userObjId,
            contentType: item.contentType,
            size: item.size,
            status: "PENDING",
            expiresAt: new Date(Date.now() + PRESIGNED_UPLOAD_EXPIRY_SECONDS * 1000),
          });
        }

        // Generate initial pre-signed view URL
        let viewUrl = "";
        try {
          viewUrl = await this.generatePresignedViewUrl(item.objectKey);
        } catch {
          // If URL generation fails, view-url endpoint will resolve it dynamically
        }

        evidenceResults.push({
          key: item.objectKey,
          objectKey: item.objectKey,
          url: viewUrl,
          originalName: item.originalName,
          mimeType: item.contentType,
          contentType: item.contentType,
          size: item.size,
          uploadedAt: new Date(),
        });
      }

      return evidenceResults;
    } catch (uploadError) {
      // Rollback: Delete any files that were already uploaded to S3 and any pending upload intents in DB
      logger.error("S3 upload batch failed, initiating rollback", {
        uploadedKeys,
        error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      });
      await this.deleteObjects(uploadedKeys);
      if (UploadIntentModel.db.readyState === 1 && uploadedKeys.length > 0) {
        try {
          await UploadIntentModel.deleteMany({ objectKey: { $in: uploadedKeys } });
        } catch {
          // Non-blocking cleanup
        }
      }
      throw uploadError;
    }
  }
}
