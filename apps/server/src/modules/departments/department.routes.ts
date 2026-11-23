import { Router, Request, Response, NextFunction } from "express";
import { DepartmentService } from "./department.service.js";
import { authenticateUser } from "../identity/clerk.middleware.js";
import { requireRole } from "../identity/rbac.middleware.js";
import { UserRole, ApiResponse, ComplaintCategory } from "@civictrack/contracts";
import { z } from "zod";
import { Types } from "mongoose";
import { ValidationError } from "../../common/errors/app-error.js";
import { IDepartmentDocument } from "./department.model.js";

const router = Router();

const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: z.string().trim().min(2).max(20),
  categories: z.array(z.nativeEnum(ComplaintCategory)).min(1, "At least one category is required"),
});

/**
 * GET /api/v1/departments
 * Public/Citizen listing of all active municipal departments
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await DepartmentService.listActive();
    const response: ApiResponse<IDepartmentDocument[]> = {
      success: true,
      data: departments,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/departments
 * Admin endpoint to register a new department
 */
router.post(
  "/",
  authenticateUser,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateDepartmentSchema.parse(req.body);
      const department = await DepartmentService.create(dto);
      const response: ApiResponse<IDepartmentDocument> = {
        success: true,
        data: department,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/departments/:id/officers
 * Returns officers belonging to the specified department
 */
router.get(
  "/:id/officers",
  authenticateUser,
  requireRole(UserRole.ADMIN, UserRole.OFFICER),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departmentId = req.params.id as string;
      if (!Types.ObjectId.isValid(departmentId)) {
        throw new ValidationError("Invalid department ID format");
      }
      if (req.user!.role === UserRole.OFFICER && req.user!.departmentId !== departmentId) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Officers are only authorized to view officers within their assigned department.",
          },
        });
        return;
      }
      const officers = await DepartmentService.listOfficers(departmentId);
      const response: ApiResponse<any[]> = {
        success: true,
        data: officers,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export const departmentRoutes = router;
