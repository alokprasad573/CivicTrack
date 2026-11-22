import { Types } from "mongoose";
import { UserModel, IUserDocument } from "./user.model.js";
import { UserRole } from "@civictrack/contracts";
import { NotFoundError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

export interface CreateOrUpdateClerkUserDto {
  clerkUserId: string;
  email: string;
  name: string;
}

export class UserService {
  public static async findByClerkUserId(clerkUserId: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ clerkUserId });
  }

  public static async findById(id: string): Promise<IUserDocument | null> {
    return UserModel.findById(id);
  }

  public static async findByEmail(email: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() });
  }

  /**
   * Idempotently upsert user on Clerk webhook user.created or user.updated
   * CRITICAL: Never overwrite existing role or departmentId with public/default values
   */
  public static async syncFromClerk(dto: CreateOrUpdateClerkUserDto): Promise<IUserDocument> {
    const email = dto.email.toLowerCase().trim();

    // Guard if database connection is not active
    if (UserModel.db.readyState !== 1) {
      logger.warn("Database not connected. Operating in offline/memory mode for Clerk sync.", {
        clerkUserId: dto.clerkUserId,
      });
      return new UserModel({
        clerkUserId: dto.clerkUserId,
        email,
        name: dto.name,
        role: UserRole.CITIZEN,
        isActive: true,
      });
    }

    const existing = await UserModel.findOne({ clerkUserId: dto.clerkUserId });

    if (existing) {
      existing.email = email;
      existing.name = dto.name;
      await existing.save();
      logger.info("Synchronized existing user from Clerk", {
        clerkUserId: dto.clerkUserId,
        role: existing.role,
      });
      return existing;
    }

    // New registration: Public registration is strictly CITIZEN role
    const newUser = await UserModel.create({
      clerkUserId: dto.clerkUserId,
      email,
      name: dto.name,
      role: UserRole.CITIZEN,
      isActive: true,
    });

    logger.info("Provisioned new local citizen from Clerk", {
      userId: newUser._id.toString(),
      clerkUserId: dto.clerkUserId,
    });

    return newUser;
  }

  /**
   * Handle user.deleted webhook:
   * Sets isActive = false rather than deleting records to maintain audit & complaint integrity
   */
  public static async deactivateUser(clerkUserId: string): Promise<void> {
    if (UserModel.db.readyState !== 1) {
      logger.warn("Database not connected. Skipping deactivateUser in offline mode.", { clerkUserId });
      return;
    }

    const user = await UserModel.findOne({ clerkUserId });
    if (!user) {
      logger.warn("Received user.deleted for non-existent local user", { clerkUserId });
      return;
    }

    user.isActive = false;
    await user.save();
    logger.info("User account deactivated via Clerk webhook", { clerkUserId, id: user._id.toString() });
  }

  /**
   * Bootstrap an initial admin user safely
   */
  public static async bootstrapAdmin(email: string, name?: string): Promise<IUserDocument> {
    const normalizedEmail = email.toLowerCase().trim();
    let user = await UserModel.findOne({ email: normalizedEmail });

    if (user) {
      user.role = UserRole.ADMIN;
      user.isActive = true;
      if (name) user.name = name;
      await user.save();
      logger.info("Promoted existing user to ADMIN", { email: normalizedEmail, id: user._id.toString() });
      return user;
    }

    // Create admin user shell (will map clerkUserId when user signs in or provides it)
    user = await UserModel.create({
      clerkUserId: `bootstrapped_${Date.now()}`,
      email: normalizedEmail,
      name: name || "System Administrator",
      role: UserRole.ADMIN,
      isActive: true,
    });

    logger.info("Created bootstrapped ADMIN user", { email: normalizedEmail, id: user._id.toString() });
    return user;
  }

  /**
   * List users with pagination and filtering for admins
   */
  public static async listUsers(options: {
    page?: number;
    limit?: number;
    role?: UserRole;
    search?: string;
  }): Promise<{ users: IUserDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (options.role) {
      query.role = options.role;
    }
    if (options.search) {
      const searchRegex = new RegExp(options.search, "i");
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments(query),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin updates user role and optionally binds to a municipal department
   */
  public static async updateRoleAndDepartment(params: {
    userId: string;
    role: UserRole;
    departmentId?: string;
  }): Promise<IUserDocument> {
    if (UserModel.db.readyState !== 1) {
      throw new NotFoundError("User not found (database offline)");
    }
    const user = await UserModel.findById(params.userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    user.role = params.role;
    if (params.role === UserRole.OFFICER && params.departmentId) {
      user.departmentId = new Types.ObjectId(params.departmentId);
    } else if (params.role !== UserRole.OFFICER) {
      user.departmentId = undefined;
    }

    await user.save();
    logger.info("Updated user role and department", {
      userId: user._id.toString(),
      role: user.role,
      departmentId: user.departmentId?.toString(),
    });
    return user;
  }
}
