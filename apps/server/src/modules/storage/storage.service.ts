import crypto from "node:crypto";
import { Types } from "mongoose";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  CreateUploadIntentDto,
  PresignedUploadItem,
  UploadIntentResponse,
  UserRole,
  ViewUrlResponse,
} from "@civictrack/contracts";
import {
  getS3Client,
  getS3BucketName,
  PRESIGNED_UPLOAD_EXPIRY_SECONDS,
  PRESIGNED_VIEW_EXPIRY_SECONDS,
} from "../../config/s3.js";
import { UploadIntentModel } from "./upload-intent.model.js";
import { ComplaintModel } from "../complaints/complaint.model.js";
import { ForbiddenError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { IAuthUser } from "../identity/identity.types.js";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class StorageService {
  /**
   * Generates short-lived S3 pre-signed PUT URLs for evidence uploads
   * Enforces unpredictable keys: evidence/{userId}/{timestamp}_{random}.{ext}
   */
  public static async createUploadIntents(params: {
    userId: string;
    dto: CreateUploadIntentDto;
  }): Promise<UploadIntentResponse> {
    const { userId, dto } = params;
    const s3Client = getS3Client();
    const bucketName = getS3BucketName();
    const expiresAt = new Date(Date.now() + PRESIGNED_UPLOAD_EXPIRY_SECONDS * 1000);

    const uploads: PresignedUploadItem[] = [];

    for (const file of dto.files) {
      const extension = MIME_EXTENSION_MAP[file.contentType] || "bin";
      const randomEntropy = crypto.randomBytes(8).toString("hex");
      const timestamp = Date.now();
      const objectKey = `evidence/${userId}/${timestamp}_${randomEntropy}.${extension}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: file.contentType,
      });

      // Generate AWS SigV4 pre-signed PUT URL
      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
      });

      // Track intent in MongoDB if database is connected
      if (UploadIntentModel.db.readyState === 1) {
        await UploadIntentModel.create({
          objectKey,
          userId: new Types.ObjectId(userId),
          contentType: file.contentType,
          size: file.size,
          checksum: file.checksum,
          status: "PENDING",
          expiresAt,
        });
      }

      uploads.push({
        objectKey,
        uploadUrl,
        method: "PUT",
        headers: {
          "Content-Type": file.contentType,
        },
        expiresInSeconds: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
      });
    }

    logger.info("Generated S3 upload intents", {
      userId,
      fileCount: dto.files.length,
      keys: uploads.map((u) => u.objectKey),
    });

    return { uploads };
  }

  /**
   * Generates a short-lived S3 pre-signed GET URL for viewing private evidence.
   * Strictly enforces object-level authorization:
   * - ADMIN can view any evidence.
   * - CITIZEN can view evidence they uploaded or attached to their own complaint.
   * - OFFICER can view evidence attached to complaints in their assigned department.
   */
  public static async getViewUrl(params: {
    objectKey: string;
    user: IAuthUser;
  }): Promise<ViewUrlResponse> {
    const { objectKey, user } = params;

    const isAuthorized = await this.verifyViewAuthorization(objectKey, user);
    if (!isAuthorized) {
      throw new ForbiddenError("You are not authorized to view this evidence.");
    }

    const s3Client = getS3Client();
    const bucketName = getS3BucketName();

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const viewUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_VIEW_EXPIRY_SECONDS,
    });

    return {
      objectKey,
      viewUrl,
      expiresInSeconds: PRESIGNED_VIEW_EXPIRY_SECONDS,
    };
  }

  /**
   * Helper to verify whether a user has permission to view an evidence objectKey
   */
  public static async verifyViewAuthorization(
    objectKey: string,
    user: IAuthUser
  ): Promise<boolean> {
    // 1. Admin can access all evidence
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // 2. User uploaded it themselves
    if (
      objectKey.startsWith(`evidence/${user.id}/`) ||
      objectKey.startsWith(`complaints/${user.id}/`) ||
      (user.clerkUserId &&
        (objectKey.startsWith(`evidence/${user.clerkUserId}/`) ||
          objectKey.startsWith(`complaints/${user.clerkUserId}/`))) ||
      (process.env.NODE_ENV !== "production" &&
        (objectKey.startsWith("evidence/mock_user/") ||
          objectKey.startsWith("complaints/mock_user/")))
    ) {
      return true;
    }

    // 3. Check complaint association if database is connected
    if (ComplaintModel.db.readyState === 1) {
      const complaint = await ComplaintModel.findOne({
        $or: [
          { "evidence.objectKey": objectKey },
          { "evidence.key": objectKey },
          { "evidenceImages.key": objectKey },
          { "evidenceImages.objectKey": objectKey },
          { "resolutionEvidence.objectKey": objectKey },
          { "resolutionEvidence.key": objectKey },
        ],
      });

      if (!complaint) {
        return false;
      }

      // Citizen owns the complaint
      if (
        user.role === UserRole.CITIZEN &&
        complaint.citizenId.toString() === user.id
      ) {
        return true;
      }

      // Officer belongs to the assigned department
      if (
        user.role === UserRole.OFFICER &&
        user.departmentId &&
        complaint.departmentId?.toString() === user.departmentId
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Marks uploaded evidence as attached to a complaint, preventing orphan cleanup
   */
  public static async markEvidenceAttached(params: {
    objectKeys: string[];
    complaintId: Types.ObjectId;
    userId: string;
  }): Promise<void> {
    const { objectKeys, complaintId, userId } = params;
    if (objectKeys.length === 0 || UploadIntentModel.db.readyState !== 1) {
      return;
    }

    const userFilter =
      process.env.NODE_ENV !== "production"
        ? {}
        : Types.ObjectId.isValid(userId)
        ? { userId: new Types.ObjectId(userId) }
        : {};

    await UploadIntentModel.updateMany(
      {
        objectKey: { $in: objectKeys },
        ...userFilter,
      },
      {
        $set: {
          status: "ATTACHED",
          complaintId,
        },
      }
    );

    logger.info("Marked evidence as attached to complaint", {
      complaintId: complaintId.toString(),
      count: objectKeys.length,
    });
  }

  /**
   * Orphan cleanup strategy:
   * Finds pending upload intents older than a cutoff threshold (e.g. 24 hours),
   * deletes the abandoned objects from S3, and marks them as EXPIRED in MongoDB.
   */
  public static async cleanupOrphanedUploads(params?: {
    olderThanHours?: number;
  }): Promise<{ cleanedCount: number; deletedKeys: string[] }> {
    const olderThanHours = params?.olderThanHours ?? 24;
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    if (UploadIntentModel.db.readyState !== 1) {
      return { cleanedCount: 0, deletedKeys: [] };
    }

    const pendingOrphans = await UploadIntentModel.find({
      status: "PENDING",
      createdAt: { $lt: cutoffDate },
    }).limit(100);

    if (pendingOrphans.length === 0) {
      return { cleanedCount: 0, deletedKeys: [] };
    }

    const s3Client = getS3Client();
    const bucketName = getS3BucketName();
    const deletedKeys: string[] = [];

    for (const orphan of pendingOrphans) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: orphan.objectKey,
          })
        );
        orphan.status = "EXPIRED";
        await orphan.save();
        deletedKeys.push(orphan.objectKey);
      } catch (err) {
        logger.error("Failed to delete orphaned S3 object", {
          objectKey: orphan.objectKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Completed orphaned upload cleanup", {
      cleanedCount: deletedKeys.length,
      olderThanHours,
    });

    return { cleanedCount: deletedKeys.length, deletedKeys };
  }
}
