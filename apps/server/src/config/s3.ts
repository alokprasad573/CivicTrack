import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";
import { logger } from "../common/utils/logger.js";

export const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 900; // 15 minutes
export const PRESIGNED_VIEW_EXPIRY_SECONDS = 3600;   // 1 hour

let s3ClientInstance: S3Client | null = null;

/**
 * Checks if production/staging AWS S3 credentials are configured with non-placeholder values
 */
export function isS3Configured(): boolean {
  if (
    !env.AWS_S3_BUCKET_NAME ||
    env.AWS_S3_BUCKET_NAME === "REPLACE_ME"
  ) {
    return false;
  }
  // In production, IAM role / default provider chain can supply credentials even if static keys are not in env
  if (env.NODE_ENV === "production") {
    return true;
  }
  if (
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY ||
    env.AWS_ACCESS_KEY_ID === "REPLACE_ME" ||
    env.AWS_SECRET_ACCESS_KEY === "REPLACE_ME"
  ) {
    return false;
  }
  return true;
}

/**
 * Returns the configured AWS S3 Client instance, or a stub client for local offline development/testing
 */
export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    if (isS3Configured()) {
      logger.info("Initializing AWS S3 Client", {
        region: env.AWS_REGION,
        bucket: env.AWS_S3_BUCKET_NAME,
      });
      if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_ACCESS_KEY_ID !== "REPLACE_ME") {
        s3ClientInstance = new S3Client({
          region: env.AWS_REGION,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        });
      } else {
        // Fall back to AWS default credential provider chain (IAM roles, ECS task roles, EC2 instance profiles)
        s3ClientInstance = new S3Client({
          region: env.AWS_REGION,
        });
      }
    } else {
      // Local dev / test client with dummy credentials
      s3ClientInstance = new S3Client({
        region: env.AWS_REGION || "ap-south-2",
        credentials: {
          accessKeyId: "mock-access-key-id",
          secretAccessKey: "mock-secret-access-key",
        },
      });
    }
  }
  return s3ClientInstance;
}

export function getS3BucketName(): string {
  return env.AWS_S3_BUCKET_NAME || "civictrack-s3-bucket";
}

export function getS3Region(): string {
  return env.AWS_REGION || "ap-south-2";
}
