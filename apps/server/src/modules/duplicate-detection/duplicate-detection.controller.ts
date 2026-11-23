import { Request, Response, NextFunction } from "express";
import { DuplicateDetectionService } from "./duplicate-detection.service.js";
import {
  ApiResponse,
  DuplicateCheckResponse,
  LinkDuplicateSchema,
  UserRole,
} from "@civictrack/contracts";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../../common/errors/app-error.js";

export class DuplicateDetectionController {
  /**
   * GET /api/v1/duplicates/:id/candidates
   * Check for potential duplicate complaint candidates
   */
  public static async getCandidates(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role === UserRole.CITIZEN) {
        throw new ForbiddenError("Only administrators and officers can inspect duplicate candidates");
      }

      const complaintId = req.params.id;
      if (!complaintId) {
        throw new ValidationError("Complaint ID is required");
      }

      const result = await DuplicateDetectionService.findCandidates(complaintId, req.user);

      const response: ApiResponse<DuplicateCheckResponse> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/duplicates/:id/link
   * Admin explicitly links a complaint as a duplicate of a primary incident
   */
  public static async linkDuplicate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role !== UserRole.ADMIN) {
        throw new ForbiddenError("Only municipal administrators can link duplicate complaints");
      }

      const complaintId = req.params.id;
      if (!complaintId) {
        throw new ValidationError("Complaint ID is required");
      }

      const body = LinkDuplicateSchema.parse(req.body);

      const updated = await DuplicateDetectionService.linkDuplicate({
        complaintId,
        duplicateOfId: body.duplicateOfId,
        user: req.user,
        remarks: body.remarks,
      });

      const response: ApiResponse<any> = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}
