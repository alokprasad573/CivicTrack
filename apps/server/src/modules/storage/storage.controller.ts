import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import {
  CreateUploadIntentSchema,
  ViewUrlQuerySchema,
  ApiResponse,
  UploadIntentResponse,
  ViewUrlResponse,
  EvidenceItem,
} from "@civictrack/contracts";
import { StorageService } from "./storage.service.js";
import { S3Service } from "./s3.service.js";
import { UnauthorizedError, ValidationError } from "../../common/errors/app-error.js";

export class StorageController {
  /**
   * Direct multipart/form-data upload of evidence files to AWS S3
   * POST /api/v1/storage/upload
   */
  public static async uploadFiles(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      let uploadedFiles: Express.Multer.File[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          uploadedFiles = req.files;
        } else {
          uploadedFiles = Object.values(req.files).flat();
        }
      }

      if (uploadedFiles.length === 0) {
        throw new ValidationError("No evidence files were provided for upload.");
      }

      const tempComplaintId = (req.body.complaintId as string) || new Types.ObjectId().toString();
      const folder = (req.body.folder as string) || "evidence";

      const uploads = await S3Service.processAndUploadEvidenceFiles({
        files: uploadedFiles,
        userId: req.user.id,
        complaintId: tempComplaintId,
        folder,
      });

      const response: ApiResponse<{ uploads: EvidenceItem[] }> = {
        success: true,
        data: { uploads },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request pre-signed S3 upload URLs for evidence
   * POST /api/v1/storage/upload-intent
   */
  public static async createUploadIntent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const dto = CreateUploadIntentSchema.parse(req.body);

      const result = await StorageService.createUploadIntents({
        userId: req.user.id,
        dto,
      });

      const response: ApiResponse<UploadIntentResponse> = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request a short-lived pre-signed GET URL to view private evidence
   * GET /api/v1/storage/view-url?objectKey=...
   */
  public static async getViewUrl(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const query = ViewUrlQuerySchema.parse(req.query);

      const result = await StorageService.getViewUrl({
        objectKey: query.objectKey,
        user: req.user,
      });

      const response: ApiResponse<ViewUrlResponse> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-triggered cleanup of abandoned/unattached evidence uploads
   * POST /api/v1/storage/cleanup
   */
  public static async cleanupOrphans(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const olderThanHours = req.query.olderThanHours
        ? Number(req.query.olderThanHours)
        : 24;

      const result = await StorageService.cleanupOrphanedUploads({
        olderThanHours,
      });

      const response: ApiResponse<{
        cleanedCount: number;
        deletedKeys: string[];
      }> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
