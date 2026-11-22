import { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "./analytics.service.js";
import {
  ApiResponse,
  IAnalyticsSummary,
  AnalyticsFilterSchema,
  UserRole,
} from "@civictrack/contracts";
import { UnauthorizedError, ForbiddenError } from "../../common/errors/app-error.js";

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/summary
   * Server-side aggregated KPI metrics, SLA adherence, and distribution breakdowns
   */
  public static async getSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role === UserRole.CITIZEN) {
        throw new ForbiddenError("Citizens do not have access to municipal operational analytics");
      }

      const filter = AnalyticsFilterSchema.parse(req.query);

      // If user is Officer, constrain filter to their assigned department
      if (req.user.role === UserRole.OFFICER && req.user.departmentId) {
        filter.departmentId = req.user.departmentId;
      }

      const summary = await AnalyticsService.getSummary(filter);

      const response: ApiResponse<IAnalyticsSummary> = {
        success: true,
        data: summary,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}
