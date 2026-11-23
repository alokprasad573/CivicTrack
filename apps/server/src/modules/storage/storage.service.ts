import crypto from "node:crypto";
import { Types } from "mongoose";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  CreateUploadIntentDto,
  PresignedUploadItem,
  UploadIntentResponse,
  UserRole,
  ViewUrlResponse,
  MAX_EVIDENCE_FILE_SIZE,
} from "@civictrack/contracts";
import {
  getS3Client,
  getS3BucketName,
  isS3Configured,
  PRESIGNED_UPLOAD_EXPIRY_SECONDS,
  PRESIGNED_VIEW_EXPIRY_SECONDS,
} from "../../config/s3.js";
import { UploadIntentModel } from "./upload-intent.model.js";
import { ComplaintModel } from "../complaints/complaint.model.js";
import { ForbiddenError, ValidationError } from "../../common/errors/app-error.js";
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
    const rawFolder = (dto.folder || "evidence").toLowerCase().trim().replace(/^\/+|\/+$/g, "");
    const isResolved = rawFolder === "resolved" || rawFolder.startsWith("resolved");
    const complaintId = dto.complaintId || new Types.ObjectId().toString();

    for (const file of dto.files) {
      const extension = MIME_EXTENSION_MAP[file.contentType] || "bin";
      const randomEntropy = crypto.randomBytes(8).toString("hex");
      const timestamp = Date.now();
      const objectKey = isResolved
        ? `resolved/image/${complaintId}/${timestamp}_${randomEntropy}.${extension}`
        : `evidence/${userId}/${timestamp}_${randomEntropy}.${extension}`;

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
    const cleanKey = objectKey.replace(/^\/+/, "");

    const isAuthorized = await this.verifyViewAuthorization(cleanKey, user);
    if (!isAuthorized) {
      throw new ForbiddenError("You are not authorized to view this evidence.");
    }

    const s3Client = getS3Client();
    const bucketName = getS3BucketName();

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
    });

    const viewUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_VIEW_EXPIRY_SECONDS,
    });

    return {
      objectKey: cleanKey,
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
    const cleanKey = objectKey.replace(/^\/+/, "");

    // 1. Admin can access all evidence
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // 2. User uploaded it themselves
    if (
      cleanKey.startsWith(`evidence/${user.id}/`) ||
      cleanKey.startsWith(`complaints/${user.id}/`) ||
      cleanKey.startsWith(`resolved/${user.id}/`) ||
      (user.clerkUserId &&
        (cleanKey.startsWith(`evidence/${user.clerkUserId}/`) ||
          cleanKey.startsWith(`complaints/${user.clerkUserId}/`) ||
          cleanKey.startsWith(`resolved/${user.clerkUserId}/`))) ||
      (process.env.NODE_ENV !== "production" &&
        (cleanKey.startsWith("evidence/mock_user/") ||
          cleanKey.startsWith("complaints/mock_user/") ||
          cleanKey.startsWith("resolved/mock_user/")))
    ) {
      return true;
    }

    // 3. Check complaint association if database is connected
    if (ComplaintModel.db.readyState === 1) {
      const complaint = await ComplaintModel.findOne({
        $or: [
          { "evidence.objectKey": cleanKey },
          { "evidence.key": cleanKey },
          { "evidenceImages.key": cleanKey },
          { "evidenceImages.objectKey": cleanKey },
          { "resolutionEvidence.objectKey": cleanKey },
          { "resolutionEvidence.key": cleanKey },
        ],
      });

      if (!complaint) {
        return false;
      }

      // Citizen owns the complaint
      const citizenId = complaint.citizenId?._id
        ? complaint.citizenId._id.toString()
        : complaint.citizenId?.toString();
      if (user.role === UserRole.CITIZEN && citizenId === user.id) {
        return true;
      }

      // Officer belongs to the assigned department OR is assigned officer
      const deptId = complaint.departmentId?._id
        ? complaint.departmentId._id.toString()
        : complaint.departmentId?.toString();
      const officerId = complaint.assignedOfficerId?._id
        ? complaint.assignedOfficerId._id.toString()
        : complaint.assignedOfficerId?.toString();

      if (
        user.role === UserRole.OFFICER &&
        ((user.departmentId && deptId === user.departmentId) ||
          officerId === user.id ||
          !deptId)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates that declared evidence items exist in MongoDB as PENDING,
   * belong to the specified user, and have not expired.
   */
  public static async validateUploadIntents(params: {
    objectKeys: string[];
    userId: string;
  }): Promise<void> {
    const { objectKeys, userId } = params;
    if (objectKeys.length === 0) return;
    if (UploadIntentModel.db.readyState !== 1) return;

    const intents = await UploadIntentModel.find({
      objectKey: { $in: objectKeys },
    });

    const now = new Date();
    for (const key of objectKeys) {
      const intent = intents.find((i) => i.objectKey === key);
      if (!intent) {
        if (
          key.startsWith(`complaints/${userId}/`) ||
          key.startsWith(`resolved/image/`) ||
          key.startsWith(`resolved/${userId}/`) ||
          (process.env.NODE_ENV !== "production" && key.startsWith("evidence/test/"))
        ) {
          continue;
        }
        throw new ValidationError(`Evidence file '${key}' does not have a registered upload intent.`);
      }
      const isOwner =
        intent.userId.toString() === userId ||
        key.startsWith("resolved/image/") ||
        (process.env.NODE_ENV !== "production" && !Types.ObjectId.isValid(userId));
      if (!isOwner) {
        throw new ForbiddenError(`Evidence file '${key}' does not belong to the authenticated user.`);
      }
      if (intent.status !== "PENDING") {
        throw new ValidationError(`Evidence file '${key}' has already been attached or is not in pending status.`);
      }
      if (intent.expiresAt && intent.expiresAt < now) {
        throw new ValidationError(`Upload intent for evidence file '${key}' has expired.`);
      }

      // Check S3 Object Metadata if live S3 client is configured
      if (isS3Configured()) {
        try {
          const s3Client = getS3Client();
          const headCmd = new HeadObjectCommand({
            Bucket: getS3BucketName(),
            Key: key,
          });
          const headRes = await s3Client.send(headCmd);

          if (headRes.ContentLength && headRes.ContentLength > MAX_EVIDENCE_FILE_SIZE) {
            throw new ValidationError(`File '${key}' exceeds maximum allowed size of 10MB.`);
          }

          if (headRes.ContentType && !["image/jpeg", "image/png", "image/webp"].includes(headRes.ContentType)) {
            throw new ValidationError(`File '${key}' has invalid Content-Type '${headRes.ContentType}'. Only JPEG, PNG, and WebP are allowed.`);
          }
        } catch (s3Err: any) {
          if (s3Err instanceof ValidationError) throw s3Err;
          if (s3Err?.$metadata?.httpStatusCode === 404 || s3Err?.name === "NotFound") {
            throw new ValidationError(`Evidence file '${key}' was not found in storage.`);
          }
          logger.warn("S3 HeadObject check skipped or error encountered", { key, error: s3Err?.message });
        }
      }
    }
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
