import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel, IUserDocument } from "./user.model.js";
import { DepartmentModel } from "../departments/department.model.js";
import { StaffSessionModel } from "../staff-auth/staff-session.model.js";
import { UserRole } from "@civictrack/contracts";
import { NotFoundError, ValidationError, ForbiddenError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { disconnectUserSockets } from "../../socket.js";

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

    const existing = await UserModel.findOne({
      $or: [{ clerkUserId: dto.clerkUserId }, { email }],
    });

    if (existing && (existing.role === UserRole.ADMIN || existing.role === UserRole.OFFICER)) {
      logger.warn("Blocked Clerk sync into staff account", {
        clerkUserId: dto.clerkUserId,
        email,
        role: existing.role,
      });
      throw new ForbiddenError("Cannot synchronize Clerk identity into a staff account.");
    }

    if (existing) {
      let modified = false;
      if (!existing.clerkUserId || existing.clerkUserId !== dto.clerkUserId) {
        existing.clerkUserId = dto.clerkUserId;
        modified = true;
      }
      if (dto.name && existing.name !== dto.name) {
        existing.name = dto.name;
        modified = true;
      }
      if (existing.email !== email) {
        existing.email = email;
        modified = true;
      }
      if (modified) {
        await existing.save();
      }
      logger.info("Synchronized existing user from Clerk", {
        clerkUserId: dto.clerkUserId,
        role: existing.role,
      });
      return existing;
    }

    // New registration: Public registration is strictly CITIZEN role
    try {
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
    } catch (createErr: any) {
      // Handle race condition: If a concurrent request created the user with the same clerkUserId or email
      const isDuplicateKey =
        createErr?.code === 11000 ||
        createErr?.codeName === "DuplicateKey" ||
        (typeof createErr?.message === "string" && createErr.message.includes("E11000"));

      if (isDuplicateKey) {
        logger.info("Concurrent Clerk sync detected on user creation, recovering existing user", {
          clerkUserId: dto.clerkUserId,
          email,
        });
        const concurrentUser = await UserModel.findOne({
          $or: [{ clerkUserId: dto.clerkUserId }, { email }],
        });
        if (concurrentUser) {
          let modified = false;
          if (!concurrentUser.clerkUserId || concurrentUser.clerkUserId !== dto.clerkUserId) {
            concurrentUser.clerkUserId = dto.clerkUserId;
            modified = true;
          }
          if (dto.name && concurrentUser.name !== dto.name) {
            concurrentUser.name = dto.name;
            modified = true;
          }
          if (modified) {
            await concurrentUser.save().catch(() => {});
          }
          return concurrentUser;
        }
      }
      throw createErr;
    }
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
   * Bootstrap an initial admin user safely with credentials
   */
  public static async bootstrapAdmin(email: string, name?: string, password?: string): Promise<IUserDocument> {
    const normalizedEmail = email.toLowerCase().trim();
    let user = await UserModel.findOne({ email: normalizedEmail }).select("+passwordHash");

    let passwordHash: string | undefined;
    if (password) {
      if (password.length < 8) {
        throw new ValidationError("Initial admin password must be at least 8 characters");
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    if (user) {
      user.role = UserRole.ADMIN;
      user.isActive = true;
      if (name) user.name = name;
      if (passwordHash) user.passwordHash = passwordHash;
      await user.save();
      logger.info("Promoted existing user to ADMIN", { email: normalizedEmail, id: user._id.toString() });
      return user;
    }

    // Create admin user with staff credentials
    user = await UserModel.create({
      clerkUserId: `bootstrapped_${Date.now()}`,
      email: normalizedEmail,
      name: name || "System Administrator",
      role: UserRole.ADMIN,
      passwordHash: passwordHash || (await bcrypt.hash("Admin@123456", 10)),
      isActive: true,
    });

    logger.info("Created bootstrapped ADMIN user", { email: normalizedEmail, id: user._id.toString() });
    return user;
  }

  /**
   * List users with pagination and filtering for admins and officers.
   * Excludes sensitive authentication hashes or third-party identities.
   */
  public static async listUsers(options: {
    page?: number;
    limit?: number;
    role?: UserRole;
    search?: string;
    departmentId?: string;
    departmentCode?: string;
    requestingAdminId?: string;
  }): Promise<{ users: IUserDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (options.role) {
      query.role = options.role;
    }

    // Scoping for Administrators: Only see officers/users in departments created by this admin
    if (options.requestingAdminId) {
      if (!Types.ObjectId.isValid(options.requestingAdminId)) {
        throw new ValidationError("Invalid requesting admin ID format");
      }
      const adminDepts = await DepartmentModel.find({
        createdByAdminId: new Types.ObjectId(options.requestingAdminId),
        isActive: true,
      }).select("_id code");

      if (adminDepts.length === 0) {
        // Admin has created no departments yet -> no officers exist for this admin
        return {
          users: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      const adminDeptIds = adminDepts.map((d) => d._id);

      if (options.departmentCode) {
        const matched = adminDepts.find(
          (d) => d.code.toUpperCase() === options.departmentCode!.trim().toUpperCase()
        );
        if (!matched) {
          // Filtered by department code not belonging to this admin
          return {
            users: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }
        query.departmentId = matched._id;
      } else if (options.departmentId) {
        if (!Types.ObjectId.isValid(options.departmentId)) {
          throw new ValidationError("Invalid department ID format");
        }
        const requestedDeptId = new Types.ObjectId(options.departmentId);
        if (!adminDeptIds.some((id) => id.equals(requestedDeptId))) {
          throw new ForbiddenError("You do not have access to view users from this department.");
        }
        query.departmentId = requestedDeptId;
      } else {
        query.departmentId = { $in: adminDeptIds };
      }
    } else {
      if (options.departmentCode) {
        const dept = await DepartmentModel.findOne({
          code: options.departmentCode.trim().toUpperCase(),
          isActive: true,
        });
        if (dept) {
          query.departmentId = dept._id;
        } else {
          // Non-existent department code returns empty result
          return {
            users: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }
      } else if (options.departmentId) {
        if (!Types.ObjectId.isValid(options.departmentId)) {
          throw new ValidationError("Invalid department ID format");
        }
        query.departmentId = new Types.ObjectId(options.departmentId);
      }
    }
    if (options.search) {
      // Escape regex metacharacters to prevent ReDoS injection
      const sanitized = options.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (sanitized.length > 0) {
        const searchRegex = new RegExp(sanitized, "i");
        query.$or = [{ name: searchRegex }, { email: searchRegex }];
      }
    }

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select("_id name email role departmentId isActive createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
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
   * Safely delete a field officer.
   * Strict validation:
   *  - Target user must exist and have role === OFFICER.
   *  - Citizens and Administrators cannot be deleted via this method.
   *  - Self-deletion is prohibited.
   * Consistent referential integrity:
   *  - Staff sessions for this officer are revoked and deleted.
   *  - WebSockets for this officer are instantly disconnected.
   *  - Pending invitations for this officer's email are revoked.
   *  - Complaints assigned to this officer have their assignedOfficerId cleared (preserved for department reassignment).
   *  - Complaint status audit history and notifications remain preserved for municipal integrity.
   */
  public static async deleteOfficer(params: {
    officerId: string;
    requestingAdminId: string;
  }): Promise<{ message: string; deletedOfficerId: string; affectedComplaintsCount: number }> {
    const { officerId, requestingAdminId } = params;

    if (!Types.ObjectId.isValid(officerId)) {
      throw new ValidationError("Invalid officer ID format");
    }

    if (officerId === requestingAdminId) {
      throw new ForbiddenError("Administrators cannot delete their own account.");
    }

    if (UserModel.db.readyState !== 1) {
      throw new NotFoundError("Officer not found (database offline)");
    }

    const officer = await UserModel.findById(officerId);
    if (!officer) {
      throw new NotFoundError("Officer not found");
    }

    // Role validation: ONLY OFFICER role can be deleted by this method
    if (officer.role !== UserRole.OFFICER) {
      throw new ForbiddenError(
        `Only accounts with the OFFICER role can be deleted. Target account has role '${officer.role}'.`
      );
    }

    // Department ownership validation: Admin can only delete officers assigned to departments they created
    if (officer.departmentId) {
      const dept = await DepartmentModel.findById(officer.departmentId);
      if (!dept || !dept.createdByAdminId || dept.createdByAdminId.toString() !== requestingAdminId) {
        throw new ForbiddenError("You can only delete officers assigned to departments you created.");
      }
    } else {
      throw new ForbiddenError("Officer is not assigned to any of your departments.");
    }

    const officerObjectId = new Types.ObjectId(officerId);

    // 1. Unassign officer from active complaints (preserve complaint record and audit trail, but clear assignment)
    const { ComplaintModel } = await import("../complaints/complaint.model.js");
    let affectedComplaintsCount = 0;
    if (ComplaintModel.db.readyState === 1) {
      const updateResult = await ComplaintModel.updateMany(
        { assignedOfficerId: officerObjectId },
        { $unset: { assignedOfficerId: 1 } }
      );
      affectedComplaintsCount = updateResult.modifiedCount;
    }

    // 2. Revoke and delete staff sessions
    if (StaffSessionModel.db.readyState === 1) {
      await StaffSessionModel.deleteMany({ userId: officerObjectId });
    }

    // 3. Disconnect open sockets immediately
    disconnectUserSockets(officerId);

    // 4. Revoke any pending invitations associated with this email
    const { StaffInvitationModel } = await import("../staff-auth/staff-invitation.model.js");
    if (StaffInvitationModel.db.readyState === 1) {
      await StaffInvitationModel.updateMany(
        { email: officer.email, status: "PENDING" },
        {
          $set: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedBy: new Types.ObjectId(requestingAdminId),
          },
        }
      );
    }

    // 5. Delete the officer record
    await UserModel.deleteOne({ _id: officerObjectId });

    logger.info("Field officer safely deleted by administrator", {
      deletedOfficerId: officerId,
      officerEmail: officer.email,
      departmentId: officer.departmentId?.toString(),
      adminId: requestingAdminId,
      affectedComplaintsCount,
    });

    return {
      message: "Officer account successfully removed and related active assignments unlinked.",
      deletedOfficerId: officerId,
      affectedComplaintsCount,
    };
  }

  /**
   * Admin updates user role and optionally binds to a municipal department.
   * Enforces role integrity, last-admin protection, and instant session revocation.
   */
  public static async updateRoleAndDepartment(params: {
    userId: string;
    role: UserRole;
    departmentId?: string;
    requestingAdminId?: string;
  }): Promise<IUserDocument> {
    if (UserModel.db.readyState !== 1) {
      throw new NotFoundError("User not found (database offline)");
    }
    const user = await UserModel.findById(params.userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Last-admin protection: cannot demote the only remaining active admin
    if (user.role === UserRole.ADMIN && params.role !== UserRole.ADMIN) {
      const otherAdmins = await UserModel.countDocuments({
        role: UserRole.ADMIN,
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenError("Cannot demote the last remaining active administrator.");
      }
    }

    // Department validation for OFFICER role
    if (params.role === UserRole.OFFICER) {
      if (!params.departmentId || !Types.ObjectId.isValid(params.departmentId)) {
        throw new ValidationError("A valid department is required when assigning the Field Officer role.");
      }
      const dept = await DepartmentModel.findById(params.departmentId);
      if (!dept || !dept.isActive) {
        throw new ValidationError("Selected department does not exist or is inactive.");
      }
      if (params.requestingAdminId) {
        if (!dept.createdByAdminId || dept.createdByAdminId.toString() !== params.requestingAdminId) {
          throw new ForbiddenError("You can only assign officers to departments you created.");
        }
      }
      user.departmentId = dept._id;
    } else {
      user.departmentId = undefined;
    }

    const previousRole = user.role;
    user.role = params.role;
    await user.save();

    // Revoke all active staff sessions if role changed
    if (previousRole !== params.role && StaffSessionModel.db.readyState === 1) {
      await StaffSessionModel.updateMany(
        { userId: user._id, isRevoked: false },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
      disconnectUserSockets(user._id.toString());
    }

    logger.info("Updated user role and department", {
      userId: user._id.toString(),
      role: user.role,
      departmentId: user.departmentId?.toString(),
    });
    return user;
  }
}
