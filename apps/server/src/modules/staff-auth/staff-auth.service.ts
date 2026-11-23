import crypto from "node:crypto";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../users/user.model.js";
import { StaffSessionModel } from "./staff-session.model.js";
import { StaffInvitationModel } from "./staff-invitation.model.js";
import { DepartmentModel } from "../departments/department.model.js";
import { JwtService } from "./jwt.service.js";
import {
  UserRole,
  PasswordSchema,
  VerifyStaffInvitationResponse,
  StaffInvitationItem,
} from "@civictrack/contracts";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { env } from "../../config/env.js";

export interface StaffAuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole.ADMIN | UserRole.OFFICER;
    departmentId?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export class StaffAuthService {
  /**
   * Authenticate staff member with email and password
   */
  public static async login(params: {
    email: string;
    password: string;
    expectedRole: UserRole.ADMIN | UserRole.OFFICER;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StaffAuthResult> {
    const normalizedEmail = params.email.toLowerCase().trim();

    // Find staff user explicitly selecting the passwordHash
    const user = await UserModel.findOne({ email: normalizedEmail }).select("+passwordHash");

    // Generic error to prevent account enumeration
    if (!user || !user.passwordHash) {
      logger.warn("Staff login failed: user not found or no password configured", {
        email: normalizedEmail,
        expectedRole: params.expectedRole,
      });
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Role check
    if (user.role !== params.expectedRole) {
      logger.warn("Staff login failed: role mismatch", {
        email: normalizedEmail,
        userRole: user.role,
        expectedRole: params.expectedRole,
      });
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Account status check
    if (!user.isActive) {
      logger.warn("Staff login failed: account deactivated", { email: normalizedEmail });
      throw new ForbiddenError("Your account has been deactivated. Please contact municipal administration.");
    }

    // Password verification
    const isValid = await bcrypt.compare(params.password, user.passwordHash);
    if (!isValid) {
      logger.warn("Staff login failed: incorrect password", { email: normalizedEmail });
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Create session in database and sign tokens
    return await StaffAuthService.createStaffSession({
      user,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Direct Administrator registration (no invite token required)
   */
  public static async adminRegister(params: {
    email: string;
    name?: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StaffAuthResult> {
    const normalizedEmail = params.email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new ValidationError("Please provide a valid work email address.");
    }

    PasswordSchema.parse(params.password);

    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (
      existingUser &&
      existingUser.isActive &&
      (existingUser.role === UserRole.ADMIN || existingUser.role === UserRole.OFFICER)
    ) {
      throw new ConflictError("An account with this email address already exists.");
    }

    const passwordHash = await bcrypt.hash(params.password, 12);
    const displayName = params.name?.trim() || normalizedEmail.split("@")[0] || "Administrator";

    let user: any;
    if (existingUser) {
      existingUser.name = displayName;
      existingUser.passwordHash = passwordHash;
      existingUser.role = UserRole.ADMIN;
      existingUser.isActive = true;
      await existingUser.save();
      user = existingUser;
    } else {
      user = await UserModel.create({
        email: normalizedEmail,
        name: displayName,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      });
    }

    logger.info("Administrator account registered directly", {
      userId: user._id.toString(),
      email: normalizedEmail,
    });

    return await this.createStaffSession({
      user,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Helper to create a staff session and generate tokens
   */
  public static async createStaffSession(params: {
    user: {
      _id: Types.ObjectId;
      email: string;
      name: string;
      role: UserRole;
      departmentId?: Types.ObjectId;
    };
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StaffAuthResult> {
    const { user, userAgent, ipAddress } = params;

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICER) {
      throw new ForbiddenError("Cannot establish staff session for non-staff role.");
    }

    const staffRole = user.role as UserRole.ADMIN | UserRole.OFFICER;

    const session = await StaffSessionModel.create({
      userId: user._id,
      role: staffRole,
      refreshTokenHash: "pending",
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const sessionId = session._id.toString();

    const accessToken = JwtService.signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: staffRole,
      departmentId: user.departmentId?.toString(),
      sessionId,
    });

    const refreshToken = JwtService.signRefreshToken({
      userId: user._id.toString(),
      sessionId,
      role: staffRole,
    });

    session.refreshTokenHash = JwtService.hashToken(refreshToken);
    await session.save();

    logger.info("Staff member session established successfully", {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId?.toString(),
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Admin-only creation of staff invitations (Officers or Admins)
   */
  public static async createInvitation(params: {
    email: string;
    role: UserRole.ADMIN | UserRole.OFFICER;
    departmentId?: string;
    invitedByUserId: string;
    baseUrl?: string;
  }): Promise<{
    invitation: any;
    rawToken: string;
    inviteLink: string;
  }> {
    const normalizedEmail = params.email.toLowerCase().trim();

    // Check if department is required
    let deptObjectId: Types.ObjectId | undefined;
    if (params.role === UserRole.OFFICER) {
      if (!params.departmentId || !Types.ObjectId.isValid(params.departmentId)) {
        throw new ValidationError("A valid departmental assignment is required for field officers.");
      }
      const department = await DepartmentModel.findById(params.departmentId);
      if (!department || !department.isActive) {
        throw new ValidationError("Assigned department is invalid or inactive.");
      }
      deptObjectId = department._id;
    }

    // Check if user already exists as active staff
    const existingUser = await UserModel.findOne({
      email: normalizedEmail,
      role: { $in: [UserRole.ADMIN, UserRole.OFFICER] },
      isActive: true,
    });
    if (existingUser) {
      throw new ConflictError(`An active ${existingUser.role.toLowerCase()} account already exists with this email.`);
    }

    // Revoke any previous pending invitations for this email
    await StaffInvitationModel.updateMany(
      { email: normalizedEmail, status: "PENDING" },
      { $set: { status: "REVOKED", revokedAt: new Date() } }
    );

    // Generate cryptographically secure token (32 bytes = 256 bits)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await StaffInvitationModel.create({
      email: normalizedEmail,
      role: params.role,
      departmentId: deptObjectId,
      tokenHash,
      status: "PENDING",
      invitedBy: new Types.ObjectId(params.invitedByUserId),
      expiresAt,
    });

    const routePrefix = params.role === UserRole.ADMIN ? "/admin/register" : "/officer/register";
    const base = params.baseUrl || env.CLIENT_URL || "http://localhost:3000";
    const inviteLink = `${base}${routePrefix}?token=${rawToken}`;

    logger.info("Created staff invitation", {
      invitationId: invitation._id.toString(),
      email: normalizedEmail,
      role: params.role,
      departmentId: deptObjectId?.toString(),
      invitedBy: params.invitedByUserId,
    });

    return {
      invitation,
      rawToken,
      inviteLink,
    };
  }

  /**
   * Preview and verify staff invitation token for onboarding form
   */
  public static async verifyInvitationToken(rawToken: string): Promise<VerifyStaffInvitationResponse> {
    if (!rawToken || rawToken.trim().length < 16) {
      throw new ValidationError("Invalid or missing invitation token.");
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
    const invitation = await StaffInvitationModel.findOne({ tokenHash }).populate("departmentId", "name code");

    if (!invitation) {
      throw new ValidationError("This invitation token does not exist or is invalid.");
    }

    if (invitation.status === "ACCEPTED") {
      throw new ValidationError("This invitation has already been accepted.");
    }

    if (invitation.status === "REVOKED") {
      throw new ValidationError("This invitation has been revoked by administration.");
    }

    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      if (invitation.status === "PENDING") {
        invitation.status = "EXPIRED";
        await invitation.save();
      }
      throw new ValidationError("This invitation token has expired. Please contact an administrator.");
    }

    const deptDoc: any = invitation.departmentId;

    return {
      valid: true,
      email: invitation.email,
      role: invitation.role,
      department: deptDoc
        ? {
            id: deptDoc._id.toString(),
            name: deptDoc.name,
            code: deptDoc.code,
          }
        : undefined,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Accept an invitation and register a new staff account
   */
  public static async acceptInvitation(params: {
    token: string;
    name: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StaffAuthResult> {
    const { token, name, password, userAgent, ipAddress } = params;

    if (!token || token.trim().length < 16) {
      throw new ValidationError("Valid invitation token is required.");
    }

    // Validate strong password
    PasswordSchema.parse(password);

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    // Atomic consumption: find and mark ACCEPTED in a single atomic condition
    const invite = await StaffInvitationModel.findOneAndUpdate(
      {
        tokenHash,
        status: "PENDING",
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!invite) {
      // Check if it was already used, expired, or invalid
      const existing = await StaffInvitationModel.findOne({ tokenHash });
      if (!existing) {
        throw new ValidationError("Invalid invitation token.");
      }
      if (existing.status === "ACCEPTED") {
        throw new ConflictError("This invitation has already been accepted.");
      }
      if (existing.status === "REVOKED") {
        throw new ForbiddenError("This invitation was revoked by administration.");
      }
      if (existing.expiresAt < new Date()) {
        throw new ValidationError("This invitation has expired.");
      }
      throw new ConflictError("Invitation cannot be accepted at this time.");
    }

    // Role and department are STRICTLY derived from the invite document!
    const targetRole = invite.role;
    const targetDepartmentId = invite.departmentId;

    // Hash the password with bcrypt (salt rounds 12)
    const passwordHash = await bcrypt.hash(password, 12);

    let user = await UserModel.findOne({ email: invite.email });

    if (user) {
      if (user.isActive && (user.role === UserRole.ADMIN || user.role === UserRole.OFFICER)) {
        // Rollback invitation consumption
        await StaffInvitationModel.findByIdAndUpdate(invite._id, {
          $set: { status: "PENDING", acceptedAt: undefined },
        });
        throw new ConflictError("An active staff account with this email address already exists.");
      }

      // Upgrade existing citizen or inactive account
      user.name = name.trim();
      user.passwordHash = passwordHash;
      user.role = targetRole;
      user.departmentId = targetDepartmentId;
      user.isActive = true;
      await user.save();
    } else {
      user = await UserModel.create({
        email: invite.email,
        name: name.trim(),
        passwordHash,
        role: targetRole,
        departmentId: targetDepartmentId,
        isActive: true,
      });
    }

    // Record acceptedBy user
    invite.acceptedBy = user._id;
    await invite.save();

    logger.info("Staff member successfully registered and onboarded via invitation", {
      userId: user._id.toString(),
      email: user.email,
      role: targetRole,
      departmentId: targetDepartmentId?.toString(),
      invitationId: invite._id.toString(),
    });

    // Create session and issue tokens
    return await this.createStaffSession({
      user,
      userAgent,
      ipAddress,
    });
  }

  /**
   * List staff invitations for administrative management
   */
  public static async listInvitations(params?: {
    status?: string;
    role?: UserRole;
  }): Promise<StaffInvitationItem[]> {
    const filter: Record<string, any> = {};
    if (params?.status) {
      filter.status = params.status;
    }
    if (params?.role) {
      filter.role = params.role;
    }

    const invitations = await StaffInvitationModel.find(filter)
      .sort({ createdAt: -1 })
      .populate("departmentId", "name code")
      .populate("invitedBy", "name email");

    return invitations.map((inv) => {
      const dept: any = inv.departmentId;
      const invBy: any = inv.invitedBy;
      return {
        id: inv._id.toString(),
        email: inv.email,
        role: inv.role,
        departmentId: dept?._id?.toString(),
        departmentName: dept?.name,
        status: inv.status,
        invitedBy: invBy
          ? {
              id: invBy._id?.toString(),
              name: invBy.name,
              email: invBy.email,
            }
          : undefined,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      };
    });
  }

  /**
   * Revoke an active staff invitation
   */
  public static async revokeInvitation(params: {
    invitationId: string;
    revokedByUserId: string;
  }): Promise<void> {
    const { invitationId, revokedByUserId } = params;
    if (!Types.ObjectId.isValid(invitationId)) {
      throw new ValidationError("Invalid invitation ID.");
    }

    const invitation = await StaffInvitationModel.findById(invitationId);
    if (!invitation) {
      throw new NotFoundError("Invitation not found.");
    }

    if (invitation.status !== "PENDING") {
      throw new ValidationError(`Cannot revoke invitation with status '${invitation.status}'.`);
    }

    invitation.status = "REVOKED";
    invitation.revokedAt = new Date();
    invitation.revokedBy = new Types.ObjectId(revokedByUserId);
    await invitation.save();

    logger.info("Staff invitation revoked", {
      invitationId,
      revokedBy: revokedByUserId,
    });
  }

  /**
   * Rotate refresh token and issue fresh access token
   */
  public static async refresh(params: {
    refreshToken: string;
    expectedRole: UserRole.ADMIN | UserRole.OFFICER;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StaffAuthResult> {
    const claims = JwtService.verifyRefreshToken(params.refreshToken);

    if (claims.role !== params.expectedRole) {
      throw new ForbiddenError("Cross-role refresh token reuse rejected.");
    }

    const tokenHash = JwtService.hashToken(params.refreshToken);

    // Atomic session verification and revocation: prevents simultaneous race conditions
    const session = await StaffSessionModel.findOneAndUpdate(
      {
        _id: claims.sessionId,
        isRevoked: false,
        refreshTokenHash: tokenHash,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      },
      { new: false }
    );

    // If session doesn't exist or is already revoked: token reuse detected! Revoke all sessions for this user.
    if (!session) {
      logger.warn("Potential refresh token reuse or revoked session detected. Revoking user sessions.", {
        userId: claims.sub,
        sessionId: claims.sessionId,
      });
      await StaffSessionModel.updateMany(
        { userId: claims.sub, isRevoked: false },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
      throw new UnauthorizedError("Session has expired or was revoked. Please log in again.");
    }

    // Verify user is still active
    const user = await UserModel.findById(claims.sub);
    if (!user || !user.isActive || user.role !== params.expectedRole) {
      await StaffSessionModel.updateMany(
        { userId: claims.sub, isRevoked: false },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
      throw new ForbiddenError("User account is inactive or role has changed.");
    }

    // Create new rotated session
    const newSession = await StaffSessionModel.create({
      userId: user._id,
      role: user.role,
      refreshTokenHash: "pending",
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const newSessionId = newSession._id.toString();

    const newAccessToken = JwtService.signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId?.toString(),
      sessionId: newSessionId,
    });

    const newRefreshToken = JwtService.signRefreshToken({
      userId: user._id.toString(),
      sessionId: newSessionId,
      role: user.role,
    });

    newSession.refreshTokenHash = JwtService.hashToken(newRefreshToken);
    await newSession.save();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role as UserRole.ADMIN | UserRole.OFFICER,
        departmentId: user.departmentId?.toString(),
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoke session on logout immediately
   */
  public static async logout(refreshToken?: string, accessToken?: string): Promise<void> {
    if (refreshToken) {
      try {
        const claims = JwtService.verifyRefreshToken(refreshToken);
        await StaffSessionModel.findByIdAndUpdate(claims.sessionId, {
          $set: { isRevoked: true, revokedAt: new Date() },
        });
        logger.info("Staff session logged out & revoked via refresh token", { sessionId: claims.sessionId, userId: claims.sub });
      } catch {
        // Gracefully ignore expired/malformed token
      }
    }

    if (accessToken) {
      try {
        const claims = JwtService.verifyAccessToken(accessToken);
        if (claims.sessionId) {
          await StaffSessionModel.findByIdAndUpdate(claims.sessionId, {
            $set: { isRevoked: true, revokedAt: new Date() },
          });
          logger.info("Staff session logged out & revoked via access token", { sessionId: claims.sessionId, userId: claims.sub });
        }
      } catch {
        // Gracefully ignore expired/malformed token
      }
    }
  }

  /**
   * Fetch current staff profile by ID
   */
  public static async getMe(userId: string): Promise<any> {
    const user = await UserModel.findById(userId).populate("departmentId", "name code categories");
    if (!user || !user.isActive) {
      throw new NotFoundError("Staff profile not found or deactivated.");
    }
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.departmentId,
      createdAt: user.createdAt,
    };
  }
}
