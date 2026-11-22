import { Types } from "mongoose";
import { DepartmentModel, IDepartmentDocument } from "./department.model.js";
import { UserModel } from "../users/user.model.js";
import { ComplaintCategory, UserRole } from "@civictrack/contracts";
import { ConflictError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

export interface CreateDepartmentDto {
  name: string;
  code: string;
  categories: ComplaintCategory[];
}

export class DepartmentService {
  public static async listActive(): Promise<IDepartmentDocument[]> {
    if (DepartmentModel.db.readyState !== 1) {
      return [];
    }
    return DepartmentModel.find({ isActive: true }).sort({ name: 1 });
  }

  public static async findById(id: string): Promise<IDepartmentDocument | null> {
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

  public static async listOfficers(departmentId: string): Promise<any[]> {
    if (UserModel.db.readyState !== 1) return [];
    if (!Types.ObjectId.isValid(departmentId)) return [];

    return UserModel.find({
      departmentId: new Types.ObjectId(departmentId),
      role: UserRole.OFFICER,
      isActive: true,
    }).select("_id name email role departmentId");
  }

  public static async create(dto: CreateDepartmentDto): Promise<IDepartmentDocument> {
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
      isActive: true,
    });

    logger.info("Created new department", { id: dept._id.toString(), code });
    return dept;
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
