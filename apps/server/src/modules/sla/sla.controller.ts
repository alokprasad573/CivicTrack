import { Request, Response, NextFunction } from "express";
import { SlaService } from "./sla.service.js";
import { ApiResponse, SlaScanResult, UserRole } from "@civictrack/contracts";
import { ForbiddenError, UnauthorizedError } from "../../common/errors/app-error.js";

export class SlaController {
  /**
   * POST /api/v1/sla/scan
   * Trigger on-demand overdue scan and escalation
   */
  public static async triggerScan(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role !== UserRole.ADMIN) {
        throw new ForbiddenError("Only administrators can trigger SLA escalation scans");
      }

      const result = await SlaService.scanAndEscalateOverdue();

      const response: ApiResponse<SlaScanResult> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/sla/overdue
   * List active overdue complaints
   */
  public static async listOverdue(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      if (req.user.role === UserRole.CITIZEN) {
        throw new ForbiddenError("Citizens cannot access overdue queue");
      }

      const overdueComplaints = await SlaService.getOverdueComplaints(req.user);

      const response: ApiResponse<any> = {
        success: true,
        data: overdueComplaints,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}
