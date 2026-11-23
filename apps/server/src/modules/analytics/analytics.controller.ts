import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
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
      if (req.user.role === UserRole.OFFICER) {
        if (!req.user.departmentId) {
          throw new ForbiddenError("Officer is not assigned to any municipal department");
        }
        filter.departmentId = req.user.departmentId;
      }

      let adminDepartmentIds: string[] | undefined;
      if (req.user.role === UserRole.ADMIN) {
        const { DepartmentModel } = await import("../departments/department.model.js");
        const adminDepts = await DepartmentModel.find({
          createdByAdminId: new Types.ObjectId(req.user.id),
          isActive: true,
        }).select("_id");
        adminDepartmentIds = adminDepts.map((d) => d._id.toString());

        if (filter.departmentId) {
          if (!adminDepartmentIds.includes(filter.departmentId)) {
            throw new ForbiddenError("You do not have access to analytics for this department.");
          }
        }
      }

      const summary = await AnalyticsService.getSummary(filter, adminDepartmentIds);

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
