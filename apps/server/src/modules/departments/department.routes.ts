import { Router, Request, Response, NextFunction } from "express";
import { DepartmentService } from "./department.service.js";
import { authenticateUser, optionalAuthenticateUser } from "../identity/clerk.middleware.js";
import { requireRole } from "../identity/rbac.middleware.js";
import { UserRole, ApiResponse, ComplaintCategory } from "@civictrack/contracts";
import { z } from "zod";
import { Types } from "mongoose";
import { ValidationError, NotFoundError } from "../../common/errors/app-error.js";
import { IDepartmentDocument } from "./department.model.js";

const router = Router();

const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: z.string().trim().min(2).max(20),
  categories: z.array(z.nativeEnum(ComplaintCategory)).min(1, "At least one category is required"),
});

/**
 * GET /api/v1/departments
 * Listing of active municipal departments.
 * Scoped strictly to departments created by the authenticated administrator if user is ADMIN.
 * Public/citizen view returns all active municipal departments.
 */
router.get("/", optionalAuthenticateUser, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let departments: IDepartmentDocument[];
    if (req.user?.role === UserRole.ADMIN) {
      // Scoped strictly to the authenticated administrator who created the department
      departments = await DepartmentService.listActive(req.user.id);
    } else {
      departments = await DepartmentService.listActive();
    }
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
 * Admin endpoint to register a new department, saving authenticated admin identity
 */
router.post(
  "/",
  authenticateUser,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateDepartmentSchema.parse(req.body);
      const department = await DepartmentService.create(dto, req.user!.id);
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
 * GET /api/v1/departments/:id
 * Direct endpoint to retrieve department details.
 * Scoped and authorized to owner admin or assigned officer.
 */
router.get(
  "/:id",
  authenticateUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departmentId = req.params.id as string;
      if (!Types.ObjectId.isValid(departmentId)) {
        throw new ValidationError("Invalid department ID format");
      }
      const department = await DepartmentService.findById(departmentId);
      if (!department) {
        throw new NotFoundError("Department not found");
      }

      if (req.user!.role === UserRole.ADMIN) {
        if (!department.createdByAdminId || department.createdByAdminId.toString() !== req.user!.id) {
          res.status(403).json({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "You do not have permission to access departments created by another administrator.",
            },
          });
          return;
        }
      } else if (req.user!.role === UserRole.OFFICER) {
        if (req.user!.departmentId !== departmentId) {
          res.status(403).json({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Officers can only view their assigned department.",
            },
          });
          return;
        }
      }

      const response: ApiResponse<IDepartmentDocument> = {
        success: true,
        data: department,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/departments/:id
 * Admin endpoint to update department with ownership verification
 */
router.patch(
  "/:id",
  authenticateUser,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departmentId = req.params.id as string;
      const updateSchema = CreateDepartmentSchema.partial().extend({
        isActive: z.boolean().optional(),
      });
      const dto = updateSchema.parse(req.body);
      const updated = await DepartmentService.update(departmentId, dto, req.user!.id);
      const response: ApiResponse<IDepartmentDocument> = {
        success: true,
        data: updated,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/departments/:id
 * Admin endpoint to delete/deactivate department with ownership verification
 */
router.delete(
  "/:id",
  authenticateUser,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departmentId = req.params.id as string;
      await DepartmentService.delete(departmentId, req.user!.id);
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: "Department successfully deactivated." },
      };
      res.status(200).json(response);
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
      const officers = await DepartmentService.listOfficers(
        departmentId,
        req.user!.role === UserRole.ADMIN ? req.user!.id : undefined
      );
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
