import { Types } from "mongoose";
import { DepartmentModel, IDepartmentDocument } from "./department.model.js";
import { UserModel } from "../users/user.model.js";
import { ComplaintCategory, UserRole } from "@civictrack/contracts";
import { ConflictError, ValidationError, ForbiddenError, NotFoundError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

export interface CreateDepartmentDto {
  name: string;
  code: string;
  categories: ComplaintCategory[];
}

export class DepartmentService {
  public static async listActive(creatorAdminId?: string): Promise<IDepartmentDocument[]> {
    if (DepartmentModel.db.readyState !== 1) {
      return [];
    }
    const query: Record<string, unknown> = { isActive: true };
    if (creatorAdminId) {
      if (!Types.ObjectId.isValid(creatorAdminId)) {
        throw new ValidationError("Invalid creator admin ID format");
      }
      query.createdByAdminId = new Types.ObjectId(creatorAdminId);
    }
    return DepartmentModel.find(query).sort({ name: 1 });
  }

  public static async findById(id: string): Promise<IDepartmentDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid department ID format");
    }
    if (DepartmentModel.db.readyState !== 1) return null;
    return DepartmentModel.findById(id);
  }

  public static async findByCode(code: string): Promise<IDepartmentDocument | null> {
    if (DepartmentModel.db.readyState !== 1) return null;
    return DepartmentModel.findOne({ code: code.toUpperCase().trim() });
  }

  public static async findByCategory(category: ComplaintCategory): Promise<IDepartmentDocument | null> {
    if (DepartmentModel.db.readyState !== 1) return null;
    return DepartmentModel.findOne({ categories: category, isActive: true });
  }

  public static async listOfficers(departmentId: string, requestingAdminId?: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(departmentId)) {
      throw new ValidationError("Invalid department ID format");
    }
    if (UserModel.db.readyState !== 1) return [];

    if (requestingAdminId) {
      const dept = await DepartmentModel.findById(departmentId);
      if (!dept) {
        throw new NotFoundError("Department not found");
      }
      if (!dept.createdByAdminId || dept.createdByAdminId.toString() !== requestingAdminId) {
        throw new ForbiddenError("You do not have permission to view officers from this department.");
      }
    }

    return UserModel.find({
      departmentId: new Types.ObjectId(departmentId),
      role: UserRole.OFFICER,
      isActive: true,
    }).select("_id name email role departmentId");
  }

  public static async create(dto: CreateDepartmentDto, creatorAdminId?: string): Promise<IDepartmentDocument> {
    const code = dto.code.toUpperCase().trim();
    if (DepartmentModel.db.readyState === 1) {
      const existing = await DepartmentModel.findOne({ code });
      if (existing) {
        throw new ConflictError(`Department with code '${code}' already exists`);
      }
    }

    const dept = await DepartmentModel.create({
      name: dto.name.trim(),
      code,
      categories: dto.categories,
      createdByAdminId: creatorAdminId ? new Types.ObjectId(creatorAdminId) : undefined,
      isActive: true,
    });

    logger.info("Created new department", {
      id: dept._id.toString(),
      code,
      createdByAdminId: creatorAdminId,
    });
    return dept;
  }

  public static async update(
    id: string,
    dto: Partial<CreateDepartmentDto> & { isActive?: boolean },
    requestingAdminId: string
  ): Promise<IDepartmentDocument> {
    const dept = await DepartmentService.findById(id);
    if (!dept) {
      throw new NotFoundError("Department not found");
    }

    if (!dept.createdByAdminId || dept.createdByAdminId.toString() !== requestingAdminId) {
      throw new ForbiddenError("You do not have permission to modify this department.");
    }

    if (dto.name) dept.name = dto.name.trim();
    if (dto.code) {
      const newCode = dto.code.toUpperCase().trim();
      if (newCode !== dept.code) {
        const existing = await DepartmentModel.findOne({ code: newCode });
        if (existing) {
          throw new ConflictError(`Department with code '${newCode}' already exists`);
        }
        dept.code = newCode;
      }
    }
    if (dto.categories) dept.categories = dto.categories;
    if (dto.isActive !== undefined) dept.isActive = dto.isActive;

    await dept.save();
    logger.info("Updated department", { id: dept._id.toString(), adminId: requestingAdminId });
    return dept;
  }

  public static async delete(id: string, requestingAdminId: string): Promise<void> {
    const dept = await DepartmentService.findById(id);
    if (!dept) {
      throw new NotFoundError("Department not found");
    }

    if (!dept.createdByAdminId || dept.createdByAdminId.toString() !== requestingAdminId) {
      throw new ForbiddenError("You do not have permission to delete this department.");
    }

    // Set inactive instead of hard deleting to preserve complaint referential integrity
    dept.isActive = false;
    await dept.save();
    logger.info("Deactivated department", { id: dept._id.toString(), adminId: requestingAdminId });
  }

  public static async seedDefaults(): Promise<void> {
    if (DepartmentModel.db.readyState !== 1) return;

    const count = await DepartmentModel.countDocuments();
    if (count > 0) return;

    const defaults: CreateDepartmentDto[] = [
      {
        name: "Roads & Transportation",
        code: "ROADS",
        categories: [ComplaintCategory.ROADS_POTHOLES],
      },
      {
        name: "Water Supply & Sewage",
        code: "WATER",
        categories: [ComplaintCategory.WATER_SUPPLY, ComplaintCategory.DRAINAGE_SEWAGE],
      },
      {
        name: "Sanitation & Solid Waste",
        code: "SANITATION",
        categories: [ComplaintCategory.GARBAGE_SANITATION],
      },
      {
        name: "Public Works & Electrical",
        code: "ELECTRICAL",
        categories: [ComplaintCategory.STREETLIGHTS, ComplaintCategory.ELECTRICITY],
      },
      {
        name: "General Municipal Affairs",
        code: "GENERAL",
        categories: [ComplaintCategory.OTHER],
      },
    ];

    for (const d of defaults) {
      await DepartmentModel.create({ ...d, isActive: true });
    }
    logger.info("Seeded default municipal departments");
  }
}
