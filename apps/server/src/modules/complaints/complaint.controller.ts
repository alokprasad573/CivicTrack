import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { ComplaintService } from "./complaint.service.js";
import { S3Service } from "../storage/s3.service.js";
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
  PaginationQuerySchema,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  ApiResponse,
  PaginatedResponse,
} from "@civictrack/contracts";
import { UnauthorizedError, ValidationError } from "../../common/errors/app-error.js";
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
    limit: z.coerce.number().min(1).max(200).default(100).optional(),
  })
  .transform((data) => ({
    lng: data.lng ?? data.longitude ?? 0,
    lat: data.lat ?? data.latitude ?? 0,
    radius: data.radiusMeters ?? data.radius,
    category: data.category,
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
      complaintObj.evidenceImages = populatedEvidence;

      const response: ApiResponse<any> = {
        success: true,
        data: complaintObj,
      };

      res.status(201).json(response);
    } catch (error) {
      // Rollback newly uploaded S3 objects if database persistence fails
      if (newlyUploadedKeys.length > 0) {
        await S3Service.deleteObjects(newlyUploadedKeys);
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
      const search = req.query.search as string | undefined;

      const result = await ComplaintService.list({
        user: req.user,
        page: query.page,
        limit: query.limit,
        status,
        category,
        priority,
        departmentId,
        search,
      });

      // Populate pre-signed view URLs for evidence items in complaints list
      const populatedComplaints = await Promise.all(
        result.complaints.map(async (c: any) => {
          const compObj = c.toObject ? c.toObject() : { ...c };
          if (compObj.evidence && compObj.evidence.length > 0) {
            compObj.evidence = await Promise.all(
              compObj.evidence.map(async (item: any) => {
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
            compObj.evidenceImages = compObj.evidence;
          }
          return compObj;
        })
      );

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
      complaintObj.evidenceImages = populatedEvidence;

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

      const response: ApiResponse<{
        complaint: any;
        history: IComplaintStatusHistoryDocument[];
      }> = {
        success: true,
        data: {
          complaint: complaintObj,
          history: result.history,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async findNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = NearbyQuerySchema.parse(req.query);

      const nearbyComplaints = await ComplaintService.findNearby({
        longitude: query.lng,
        latitude: query.lat,
        maxDistanceMeters: query.radius,
        category: query.category,
        limit: query.limit,
      });

      // Normalize output and populate pre-signed view URLs for evidence items if present
      const populated = await Promise.all(
        nearbyComplaints.map(async (c: any) => {
          const obj = c.toObject ? c.toObject() : { ...c };
          obj.id = obj._id?.toString() || obj.id;
          if (obj.evidence && obj.evidence.length > 0) {
            obj.evidence = await Promise.all(
              obj.evidence.map(async (item: any) => {
                const key = item.objectKey || item.key;
                let url = item.url;
                if (key) {
                  try {
                    url = await S3Service.generatePresignedViewUrl(key);
                  } catch {
                    url = item.url || "";
                  }
                }
                return { ...item, key, objectKey: key, url };
              })
            );
            obj.evidenceImages = obj.evidence;
          }
          return obj;
        })
      );

      const response: ApiResponse<any[]> = {
        success: true,
        data: populated,
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
    try {
      if (!req.user) throw new UnauthorizedError("Authentication required");

      const dto = ResolveComplaintSchema.parse(req.body);
      const updated = await ComplaintService.resolve({
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
