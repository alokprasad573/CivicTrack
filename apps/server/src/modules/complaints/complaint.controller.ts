import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { ComplaintService } from "./complaint.service.js";
import { S3Service } from "../storage/s3.service.js";
import { UploadIntentModel } from "../storage/upload-intent.model.js";
import {
  CreateComplaintSchema,
  EvidenceItem,
  SubmitFeedbackSchema,
  ReviewComplaintSchema,
  VerifyComplaintSchema,
  RejectComplaintSchema,
  AssignComplaintSchema,
  StartWorkSchema,
  ResolveComplaintSchema,
  CloseComplaintSchema,
  PaginationQuerySchema,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  ApiResponse,
  PaginatedResponse,
} from "@civictrack/contracts";
import { UnauthorizedError, ValidationError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { IComplaintDocument } from "./complaint.model.js";
import { IComplaintStatusHistoryDocument } from "./complaint-history.model.js";
import { z } from "zod";

const NearbyQuerySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    radius: z.coerce.number().min(50).max(100000).default(10000), // Default 10km (10,000m), max 100km
    radiusMeters: z.coerce.number().min(50).max(100000).optional(),
    category: z.nativeEnum(ComplaintCategory).optional(),
    status: z.string().optional(),
    includeClosed: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((val) => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
        return false;
      }),
    limit: z.coerce.number().min(1).max(200).default(100).optional(),
  })
  .transform((data) => ({
    lng: data.lng ?? data.longitude ?? 77.5946,
    lat: data.lat ?? data.latitude ?? 12.9716,
    radius: data.radiusMeters ?? data.radius,
    category: data.category,
    status: data.status,
    includeClosed: data.includeClosed ?? false,
    limit: data.limit,
  }));

export class ComplaintController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const newlyUploadedKeys: string[] = [];
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      // Extract uploaded multipart files if any
      let uploadedFiles: Express.Multer.File[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          uploadedFiles = req.files;
        } else {
          uploadedFiles = Object.values(req.files).flat();
        }
      }

      const bodyData = { ...req.body };
      if (typeof bodyData.location === "string") {
        try {
          bodyData.location = JSON.parse(bodyData.location);
        } catch {
          // Handled by zod validation
        }
      }

      // If files were provided via multipart, validate & upload them directly to real AWS S3
      let multipartEvidence: EvidenceItem[] = [];
      if (uploadedFiles.length > 0) {
        const batchComplaintId = new Types.ObjectId().toString();
        multipartEvidence = await S3Service.processAndUploadEvidenceFiles({
          files: uploadedFiles,
          userId: req.user.id,
          complaintId: batchComplaintId,
        });
        multipartEvidence.forEach((item) => newlyUploadedKeys.push(item.objectKey));
      }

      // Merge with any pre-existing or pre-signed evidence descriptors
      let existingEvidence: any[] = [];
      if (bodyData.evidence) {
        if (typeof bodyData.evidence === "string") {
          try {
            existingEvidence = JSON.parse(bodyData.evidence);
          } catch {
            existingEvidence = [];
          }
        } else if (Array.isArray(bodyData.evidence)) {
          existingEvidence = bodyData.evidence;
        }
      }

      const combinedEvidence = [...existingEvidence, ...multipartEvidence];
      bodyData.evidence = combinedEvidence;

      const dto = CreateComplaintSchema.parse(bodyData);
      const complaint = await ComplaintService.create({
        citizenId: req.user.id,
        dto,
      });

      // Populate fresh pre-signed GET URLs for client display
      const populatedEvidence = await Promise.all(
        (complaint.evidence || []).map(async (item: any) => {
          const key = item.objectKey || item.key;
          let url = item.url;
          if (key) {
            try {
              url = await S3Service.generatePresignedViewUrl(key);
            } catch {
              url = item.url || "";
            }
          }
          return {
            ...item,
            key,
            objectKey: key,
            url,
          };
        })
      );

      const complaintObj = complaint.toObject ? complaint.toObject() : { ...complaint };
      complaintObj.evidence = populatedEvidence;


      const response: ApiResponse<any> = {
        success: true,
        data: complaintObj,
      };

      res.status(201).json(response);
    } catch (error) {
      // Rollback newly uploaded S3 objects and pending intents if database persistence fails
      if (newlyUploadedKeys.length > 0) {
        await S3Service.deleteObjects(newlyUploadedKeys);
        if (UploadIntentModel.db.readyState === 1) {
          try {
            await UploadIntentModel.deleteMany({ objectKey: { $in: newlyUploadedKeys } });
          } catch {
            // ignore rollback error
          }
        }
      }
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const query = PaginationQuerySchema.parse(req.query);
      const status = req.query.status as ComplaintStatus | undefined;
      const category = req.query.category as ComplaintCategory | undefined;
      const priority = req.query.priority as ComplaintPriority | undefined;
      const departmentId = req.query.departmentId as string | undefined;
      if (departmentId && !Types.ObjectId.isValid(departmentId)) {
        throw new ValidationError("Invalid department ID format");
      }
      const search = req.query.search as string | undefined;
      const assignedToMe = req.query.assignedToMe === "true";

      const result = await ComplaintService.list({
        user: req.user,
        page: query.page,
        limit: query.limit,
        status,
        category,
        priority,
        departmentId,
        search,
        assignedToMe,
      });

      // List responses return evidence object-key metadata only (no expensive S3 presigning).
      // Fresh signed URLs are generated on demand via getById / view-url.
      const populatedComplaints = result.complaints.map((c: any) => {
        const compObj = c.toObject ? c.toObject() : { ...c };
        const normalize = (items: any[]) =>
          (items || []).map((item: any) => {
            const key = item.objectKey || item.key;
            const { url: _url, ...rest } = item || {};
            return { ...rest, key, objectKey: key };
          });
        if (Array.isArray(compObj.evidence)) compObj.evidence = normalize(compObj.evidence);
        if (Array.isArray(compObj.resolutionEvidence)) compObj.resolutionEvidence = normalize(compObj.resolutionEvidence);
        return compObj;
      });

      const response: PaginatedResponse<any> = {
        success: true,
        data: populatedComplaints,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPrevPage: result.page > 1,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const id = req.params.id;
      if (!id) throw new ValidationError("Complaint ID is required");

      const result = await ComplaintService.getById(id, req.user);

      // Populate fresh pre-signed view URLs for all evidence items
      const populatedEvidence = await Promise.all(
        (result.complaint.evidence || []).map(async (item: any) => {
          const key = item.objectKey || item.key;
          let url = item.url;
          if (key) {
            try {
              url = await S3Service.generatePresignedViewUrl(key);
            } catch {
              url = item.url || "";
            }
          }
          return {
            ...item,
            key,
            objectKey: key,
            url,
          };
        })
      );

      const complaintObj = result.complaint.toObject ? result.complaint.toObject() : { ...result.complaint };
      complaintObj.evidence = populatedEvidence;

      if (complaintObj.resolutionEvidence && complaintObj.resolutionEvidence.length > 0) {
        complaintObj.resolutionEvidence = await Promise.all(
          complaintObj.resolutionEvidence.map(async (item: any) => {
            const key = item.objectKey || item.key;
            let url = item.url;
            if (key) {
              try {
                url = await S3Service.generatePresignedViewUrl(key);
              } catch {
                url = item.url || "";
              }
            }
            return {
              ...item,
              key,
              objectKey: key,
              url,
            };
          })
        );
      }

      // Populate fresh presigned view URLs for history evidence items
      const populatedHistory = await Promise.all(
        (result.history || []).map(async (histDoc: any) => {
          const h = histDoc.toObject ? histDoc.toObject() : { ...histDoc };
          if (h.evidence && h.evidence.length > 0) {
            h.evidence = await Promise.all(
              h.evidence.map(async (item: any) => {
                const key = item.objectKey || item.key;
                let url = item.url;
                if (key) {
                  try {
                    url = await S3Service.generatePresignedViewUrl(key);
                  } catch {
                    url = item.url || "";
                  }
                }
                return {
                  ...item,
                  key,
                  objectKey: key,
                  url,
                };
              })
            );
          } else if (
            h.toStatus === ComplaintStatus.RESOLVED &&
            complaintObj.resolutionEvidence &&
            complaintObj.resolutionEvidence.length > 0
          ) {
            h.evidence = complaintObj.resolutionEvidence;
          }
          return h;
        })
      );

      const response: ApiResponse<{
        complaint: any;
        history: IComplaintStatusHistoryDocument[];
      }> = {
        success: true,
        data: {
          complaint: complaintObj,
          history: populatedHistory,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async findNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = NearbyQuerySchema.parse(req.query) as {
        lng: number;
        lat: number;
        radius: number;
        category?: ComplaintCategory;
        status?: string;
        includeClosed?: boolean;
        limit?: number;
      };

      const nearbyComplaints = await ComplaintService.findNearby({
        longitude: query.lng,
        latitude: query.lat,
        maxDistanceMeters: query.radius,
        category: query.category,
        status: query.status,
        includeClosed: query.includeClosed,
        limit: query.limit,
      });

      // Explicit allowlist DTO strictly omitting citizen PII, internal assignments, evidence keys, and signed URLs
      const publicData = nearbyComplaints.map((c: any) => ({
        id: c._id?.toString() || c.id,
        referenceNumber: c.referenceNumber,
        title: c.title,
        category: c.category,
        status: c.status,
        priority: c.priority,
        location: c.location,
        address: c.address,
        createdAt: c.createdAt,
      }));

      const response: ApiResponse<any[]> = {
        success: true,
        data: publicData,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = SubmitFeedbackSchema.parse(req.body);
      const updatedComplaint = await ComplaintService.submitFeedback({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updatedComplaint,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = ReviewComplaintSchema.parse(req.body);
      const updated = await ComplaintService.review({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = VerifyComplaintSchema.parse(req.body);
      const updated = await ComplaintService.verify({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = RejectComplaintSchema.parse(req.body);
      const updated = await ComplaintService.reject({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = AssignComplaintSchema.parse(req.body);
      const updated = await ComplaintService.assign({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async startWork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = StartWorkSchema.parse(req.body);
      const updated = await ComplaintService.startWork({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    const newlyUploadedKeys: string[] = [];
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const complaintId = req.params.id as string;
      if (!complaintId) throw new ValidationError("Complaint ID is required");

      // Extract uploaded multipart files if any
      let uploadedFiles: Express.Multer.File[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          uploadedFiles = req.files;
        } else {
          uploadedFiles = Object.values(req.files).flat();
        }
      }

      // If files were provided via multipart, validate & upload them to AWS S3 under resolved/image/{complaintId}/...
      let multipartEvidence: EvidenceItem[] = [];
      if (uploadedFiles.length > 0) {
        multipartEvidence = await S3Service.processAndUploadEvidenceFiles({
          files: uploadedFiles,
          userId: req.user.id,
          complaintId,
          folder: "resolved",
        });
        multipartEvidence.forEach((item) => newlyUploadedKeys.push(item.objectKey));
      }

      const bodyData = { ...req.body };
      let existingEvidence: any[] = [];
      const rawEvidence = bodyData.evidence || bodyData.resolutionEvidence;
      if (rawEvidence) {
        if (typeof rawEvidence === "string") {
          try {
            existingEvidence = JSON.parse(rawEvidence);
          } catch {
            existingEvidence = [];
          }
        } else if (Array.isArray(rawEvidence)) {
          existingEvidence = rawEvidence;
        }
      }

      const combinedEvidence = [...existingEvidence, ...multipartEvidence];
      bodyData.evidence = combinedEvidence;
      bodyData.resolutionEvidence = combinedEvidence;

      const dto = ResolveComplaintSchema.parse(bodyData);
      const updated = await ComplaintService.resolve({
        idOrRef: complaintId,
        user: req.user,
        dto,
      });

      const compObj = updated.toObject ? updated.toObject() : { ...updated };
      if (compObj.resolutionEvidence && compObj.resolutionEvidence.length > 0) {
        compObj.resolutionEvidence = await Promise.all(
          compObj.resolutionEvidence.map(async (item: any) => {
            const key = item.objectKey || item.key;
            let url = item.url;
            if (key) {
              try {
                url = await S3Service.generatePresignedViewUrl(key);
              } catch {
                url = item.url || "";
              }
            }
            return {
              ...item,
              key,
              objectKey: key,
              url,
            };
          })
        );
      }

      const response: ApiResponse<any> = {
        success: true,
        data: compObj,
      };

      res.status(200).json(response);
    } catch (error) {
      if (newlyUploadedKeys.length > 0) {
        S3Service.deleteObjects(newlyUploadedKeys).catch((err) => {
          logger.error("Failed to delete resolution S3 objects on error rollback", {
            keys: newlyUploadedKeys,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
      next(error);
    }
  }

  public static async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = CloseComplaintSchema.parse(req.body || {});
      const updated = await ComplaintService.close({
        idOrRef: req.params.id as string,
        user: req.user,
        dto,
      });

      const response: ApiResponse<IComplaintDocument> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
