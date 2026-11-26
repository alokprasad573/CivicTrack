import { Types } from "mongoose";
import { ComplaintModel, IComplaintDocument } from "./complaint.model.js";
import { ComplaintStatusHistoryModel, IComplaintStatusHistoryDocument } from "./complaint-history.model.js";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  UserRole,
} from "@civictrack/contracts";
import { NotFoundError, ForbiddenError, ValidationError, ServiceUnavailableError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { IAuthUser } from "../identity/identity.types.js";

export class ComplaintQueryService {
  /**
   * Helper: Find complaint document by ID or Reference Number
   */
  public static async findComplaint(idOrRef: string): Promise<IComplaintDocument> {
    if (ComplaintModel.db.readyState !== 1) {
      throw new NotFoundError("Complaint not found (database offline)");
    }
    const isObjectId = Types.ObjectId.isValid(idOrRef);
    const query = isObjectId
      ? { $or: [{ _id: new Types.ObjectId(idOrRef) }, { referenceNumber: idOrRef }] }
      : { referenceNumber: idOrRef };

    const complaint = await ComplaintModel.findOne(query);
    if (!complaint) {
      throw new NotFoundError(`Complaint '${idOrRef}' not found`);
    }
    return complaint;
  }

  /**
   * Get complaint by ID or Reference Number with object-level authorization
   */
  public static async getById(
    idOrRef: string,
    user: IAuthUser
  ): Promise<{ complaint: IComplaintDocument; history: IComplaintStatusHistoryDocument[] }> {
    const isObjectId = Types.ObjectId.isValid(idOrRef);
    const query = isObjectId
      ? { $or: [{ _id: new Types.ObjectId(idOrRef) }, { referenceNumber: idOrRef }] }
      : { referenceNumber: idOrRef };

    if (ComplaintModel.db.readyState !== 1) {
      throw new NotFoundError("Complaint not found (database offline)");
    }

    const complaint = await ComplaintModel.findOne(query)
      .populate("citizenId", "name email")
      .populate("departmentId", "name code")
      .populate("assignedOfficerId", "name email");

    if (!complaint) {
      throw new NotFoundError(`Complaint '${idOrRef}' not found`);
    }

    // Object-Level Authorization Check
    if (user.role === UserRole.CITIZEN) {
      const ownerId =
        complaint.citizenId instanceof Types.ObjectId
          ? complaint.citizenId.toString()
          : (complaint.citizenId as unknown as { _id: Types.ObjectId })._id.toString();

      if (ownerId !== user.id) {
        logger.warn("Unauthorized complaint access attempt by citizen", {
          attemptedId: idOrRef,
          userId: user.id,
        });
        throw new ForbiddenError("You do not have permission to view this complaint");
      }
    } else if (user.role === UserRole.OFFICER) {
      const deptId = complaint.departmentId
        ? complaint.departmentId instanceof Types.ObjectId
          ? complaint.departmentId.toString()
          : (complaint.departmentId as unknown as { _id: Types.ObjectId })._id.toString()
        : null;

      if (!deptId || deptId !== user.departmentId) {
        logger.warn("Unauthorized complaint access attempt by officer outside department", {
          attemptedId: idOrRef,
          officerDept: user.departmentId,
          complaintDept: deptId,
        });
        throw new ForbiddenError("You can only view complaints within your assigned department");
      }
    } else if (user.role === UserRole.ADMIN) {
      const deptId = complaint.departmentId
        ? complaint.departmentId instanceof Types.ObjectId
          ? complaint.departmentId.toString()
          : (complaint.departmentId as unknown as { _id: Types.ObjectId })._id.toString()
        : null;

      if (deptId) {
        const { DepartmentModel } = await import("../departments/department.model.js");
        const dept = await DepartmentModel.findById(deptId);
        if (dept && dept.createdByAdminId && dept.createdByAdminId.toString() !== user.id) {
          throw new ForbiddenError("You do not have permission to view complaints belonging to another administrator's department.");
        }
      }
    }

    const history = await ComplaintStatusHistoryModel.find({ complaintId: complaint._id })
      .sort({ createdAt: 1 })
      .populate("actorId", "name role");

    return { complaint, history };
  }

  /**
   * List complaints with role-based scoping and pagination
   */
  public static async list(options: {
    user: IAuthUser;
    page?: number;
    limit?: number;
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    priority?: ComplaintPriority;
    departmentId?: string;
    assignedOfficerId?: string;
    assignedToMe?: boolean;
    search?: string;
  }): Promise<{ complaints: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    // Role-based scoping: Citizens only see their own complaints
    if (options.user.role === UserRole.CITIZEN) {
      query.citizenId = new Types.ObjectId(options.user.id);
    } else if (options.user.role === UserRole.OFFICER) {
      if (options.departmentId) {
        if (!Types.ObjectId.isValid(options.departmentId)) {
          throw new ValidationError("Invalid department ID format");
        }
        if (options.user.departmentId && options.departmentId !== options.user.departmentId) {
          throw new ForbiddenError("Officers cannot view complaints outside their assigned department");
        }
      }
      if (options.assignedToMe) {
        query.assignedOfficerId = new Types.ObjectId(options.user.id);
      } else {
        if (options.user.departmentId) {
          query.departmentId = new Types.ObjectId(options.user.departmentId);
        }
        if (options.assignedOfficerId) {
          if (!Types.ObjectId.isValid(options.assignedOfficerId)) {
            throw new ValidationError("Invalid officer ID format");
          }
          query.assignedOfficerId = new Types.ObjectId(options.assignedOfficerId);
        }
      }
    } else if (options.user.role === UserRole.ADMIN) {
      const { DepartmentModel } = await import("../departments/department.model.js");
      const allDepts = await DepartmentModel.find({}).select("_id createdByAdminId isActive");
      const adminDeptIds = allDepts
        .filter((d: any) => d.createdByAdminId && d.createdByAdminId.toString() === options.user.id && d.isActive)
        .map((d: any) => d._id);
      const otherDeptIds = allDepts
        .filter((d: any) => d.createdByAdminId && d.createdByAdminId.toString() !== options.user.id)
        .map((d: any) => d._id);

      if (options.departmentId) {
        if (!Types.ObjectId.isValid(options.departmentId)) {
          throw new ValidationError("Invalid department ID format");
        }
        const requestedId = new Types.ObjectId(options.departmentId);
        if (!adminDeptIds.some((id: any) => id.equals(requestedId))) {
          throw new ForbiddenError("You do not have permission to view complaints for this department.");
        }
        query.departmentId = requestedId;
      } else {
        // Exclude complaints assigned to other admins' departments
        if (otherDeptIds.length > 0) {
          query.departmentId = { $nin: otherDeptIds };
        }
      }
      if (options.assignedOfficerId) {
        if (!Types.ObjectId.isValid(options.assignedOfficerId)) {
          throw new ValidationError("Invalid officer ID format");
        }
        query.assignedOfficerId = new Types.ObjectId(options.assignedOfficerId);
      }
    }

    if (options.status) query.status = options.status;
    if (options.category) query.category = options.category;
    if (options.priority) query.priority = options.priority;

    if (options.search) {
      const sanitized = options.search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (sanitized.length > 0) {
        const searchRegex = new RegExp(sanitized, "i");
        query.$or = [{ title: searchRegex }, { referenceNumber: searchRegex }, { address: searchRegex }];
      }
    }

    if (ComplaintModel.db.readyState !== 1) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableError("Database is currently unavailable");
      }
      return { complaints: [], total: 0, page, limit, totalPages: 0 };
    }

    const [complaints, total] = await Promise.all([
      ComplaintModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("citizenId", "name email")
        .populate("departmentId", "name code")
        .populate("assignedOfficerId", "name email")
        .lean(),
      ComplaintModel.countDocuments(query),
    ]);

    return {
      complaints,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find nearby complaints using 2dsphere spatial index
   */
  public static async findNearby(params: {
    longitude: number;
    latitude: number;
    maxDistanceMeters?: number;
    category?: ComplaintCategory;
    status?: string;
    includeClosed?: boolean;
    limit?: number;
  }): Promise<IComplaintDocument[]> {
    const {
      longitude,
      latitude,
      maxDistanceMeters = 10000,
      category,
      status,
      includeClosed = false,
      limit = 100,
    } = params;

    if (ComplaintModel.db.readyState !== 1) {
      return [];
    }

    const query: Record<string, unknown> = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    };

    if (status) {
      if (status === "ACTIVE") {
        query.status = {
          $nin: [
            ComplaintStatus.REJECTED,
            ComplaintStatus.RESOLVED,
            ComplaintStatus.CLOSED,
          ],
        };
      } else if (status === "CLOSED_RESOLVED") {
        query.status = {
          $in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
        };
      } else {
        query.status = status;
      }
    } else if (!includeClosed) {
      query.status = { $nin: [ComplaintStatus.REJECTED, ComplaintStatus.CLOSED] };
    } else {
      query.status = { $nin: [ComplaintStatus.REJECTED] };
    }

    if (category) {
      query.category = category;
    }

    try {
      return await ComplaintModel.find(query)
        .select("_id referenceNumber title category status priority location address createdAt")
        .limit(limit);
    } catch (err: any) {
      if (err?.message?.includes("unable to find index for $geoNear query")) {
        logger.warn("2dsphere index missing for findNearby. Auto-creating index and retrying...");
        try {
          await ComplaintModel.createIndexes();
          return await ComplaintModel.find(query)
            .select("_id referenceNumber title category status priority location address createdAt")
            .limit(limit);
        } catch (retryErr) {
          logger.error("Failed to build 2dsphere index on demand for findNearby", { error: retryErr });
          return [];
        }
      }
      throw err;
    }
  }
}
