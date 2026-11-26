import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { StaffAuthService } from "./staff-auth.service.js";
import { JwtService } from "./jwt.service.js";
import {
  UserRole,
  ApiResponse,
  AdminRegisterSchema,
  CreateStaffInvitationSchema,
  AcceptStaffInvitationSchema,
} from "@civictrack/contracts";
import { env } from "../../config/env.js";
import { disconnectUserSockets } from "../../socket.js";

const LoginSchema = z.object({
  email: z.string().email("Valid email address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export class StaffAuthController {
  private static getCookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: maxAgeMs,
      path: "/",
    };
  }

  /**
   * Helper to set cookies for Admin or Officer
   */
  private static setStaffCookies(
    res: Response,
    role: UserRole.ADMIN | UserRole.OFFICER,
    accessToken: string,
    refreshToken: string
  ): void {
    const accessCookie = role === UserRole.ADMIN ? "civictrack_admin_token" : "civictrack_officer_token";
    const refreshCookie = role === UserRole.ADMIN ? "civictrack_admin_refresh" : "civictrack_officer_refresh";

    // Access token cookie: 15 minutes
    res.cookie(accessCookie, accessToken, StaffAuthController.getCookieOptions(15 * 60 * 1000));

    // Refresh token cookie: 7 days
    res.cookie(refreshCookie, refreshToken, StaffAuthController.getCookieOptions(7 * 24 * 60 * 60 * 1000));
  }

  /**
   * Helper to clear staff cookies on logout
   */
  private static clearStaffCookies(res: Response, role: UserRole.ADMIN | UserRole.OFFICER): void {
    const accessCookie = role === UserRole.ADMIN ? "civictrack_admin_token" : "civictrack_officer_token";
    const refreshCookie = role === UserRole.ADMIN ? "civictrack_admin_refresh" : "civictrack_officer_refresh";

    res.clearCookie(accessCookie, { path: "/" });
    res.clearCookie(refreshCookie, { path: "/" });
  }

  /**
   * POST /api/v1/admin/auth/login
   */
  public static async adminLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = LoginSchema.parse(req.body);
      const result = await StaffAuthService.login({
        email: dto.email,
        password: dto.password,
        expectedRole: UserRole.ADMIN,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      StaffAuthController.setStaffCookies(res, UserRole.ADMIN, result.accessToken, result.refreshToken);

      const response: ApiResponse<{ user: typeof result.user; accessToken: string }> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/auth/register
   * Direct Administrator registration (no invitation token required)
   */
  public static async adminRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = AdminRegisterSchema.parse(req.body);

      const result = await StaffAuthService.adminRegister({
        email: dto.email,
        name: dto.name,
        password: dto.password,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      StaffAuthController.setStaffCookies(res, UserRole.ADMIN, result.accessToken, result.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/auth/refresh
   */
  public static async adminRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.civictrack_admin_refresh || req.body?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Refresh token required." } });
        return;
      }

      const result = await StaffAuthService.refresh({
        refreshToken,
        expectedRole: UserRole.ADMIN,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      StaffAuthController.setStaffCookies(res, UserRole.ADMIN, result.accessToken, result.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/auth/logout
   */
  public static async adminLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let logoutUserId = req.user?.id;
      if (!logoutUserId) {
        const token = req.cookies?.civictrack_admin_token || req.cookies?.civictrack_officer_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : undefined);
        if (token) {
          try { const claims = JwtService.verifyAccessToken(token); logoutUserId = claims.sub; } catch (e) { }
        }
      }
      if (logoutUserId) { disconnectUserSockets(logoutUserId); }
      const refreshToken = req.cookies?.civictrack_admin_refresh || req.body?.refreshToken;
      const accessToken = req.cookies?.civictrack_admin_token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : undefined);
      await StaffAuthService.logout(refreshToken, accessToken);
      StaffAuthController.clearStaffCookies(res, UserRole.ADMIN);

      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/auth/me
   */
  public static async adminGetMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin access required." } });
        return;
      }
      const profile = await StaffAuthService.getMe(req.user.id);
      res.status(200).json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/officer/auth/login
   */
  public static async officerLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = LoginSchema.parse(req.body);
      const result = await StaffAuthService.login({
        email: dto.email,
        password: dto.password,
        expectedRole: UserRole.OFFICER,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      StaffAuthController.setStaffCookies(res, UserRole.OFFICER, result.accessToken, result.refreshToken);

      const response: ApiResponse<{ user: typeof result.user; accessToken: string }> = {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/officer/auth/refresh
   */
  public static async officerRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.civictrack_officer_refresh || req.body?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Refresh token required." } });
        return;
      }

      const result = await StaffAuthService.refresh({
        refreshToken,
        expectedRole: UserRole.OFFICER,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      StaffAuthController.setStaffCookies(res, UserRole.OFFICER, result.accessToken, result.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/officer/auth/logout
   */
  public static async officerLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let logoutUserId = req.user?.id;
      if (!logoutUserId) {
        const token = req.cookies?.civictrack_admin_token || req.cookies?.civictrack_officer_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : undefined);
        if (token) {
          try { const claims = JwtService.verifyAccessToken(token); logoutUserId = claims.sub; } catch (e) { }
        }
      }
      if (logoutUserId) { disconnectUserSockets(logoutUserId); }
      const refreshToken = req.cookies?.civictrack_officer_refresh || req.body?.refreshToken;
      const accessToken = req.cookies?.civictrack_officer_token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : undefined);
      await StaffAuthService.logout(refreshToken, accessToken);
      StaffAuthController.clearStaffCookies(res, UserRole.OFFICER);

      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/officer/auth/me
   */
  public static async officerGetMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== UserRole.OFFICER) {
        res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Officer access required." } });
        return;
      }
      const profile = await StaffAuthService.getMe(req.user.id);
      res.status(200).json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/invitations
   * Create a new staff invitation (Officers or Admins)
   */
  public static async adminCreateInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Administrator access required." } });
        return;
      }

      const dto = CreateStaffInvitationSchema.parse(req.body);
      const originHeader = (req.headers.origin || req.headers.referer) as string | undefined;
      let baseUrl: string | undefined;
      if (originHeader) {
        try {
          const parsed = new URL(originHeader);
          baseUrl = `${parsed.protocol}//${parsed.host}`;
        } catch {}
      }

      const result = await StaffAuthService.createInvitation({
        email: dto.email,
        role: dto.role,
        departmentId: dto.departmentId,
        invitedByUserId: req.user.id,
        baseUrl,
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          id: result.invitation._id.toString(),
          email: result.invitation.email,
          role: result.invitation.role,
          departmentId: result.invitation.departmentId?.toString(),
          status: result.invitation.status,
          expiresAt: result.invitation.expiresAt.toISOString(),
          token: result.rawToken,
          inviteLink: result.inviteLink,
        },
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/invitations
   * List staff invitations for administration
   */
  public static async adminListInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Administrator access required." } });
        return;
      }

      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const role = req.query.role === UserRole.ADMIN || req.query.role === UserRole.OFFICER ? req.query.role : undefined;

      const invitations = await StaffAuthService.listInvitations({ status, role });

      res.status(200).json({
        success: true,
        data: invitations,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/invitations/:id/revoke
   * Revoke an active staff invitation
   */
  public static async adminRevokeInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Administrator access required." } });
        return;
      }

      const invitationId = req.params.id as string;
      if (!invitationId) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invitation ID is required." } });
        return;
      }

      await StaffAuthService.revokeInvitation({
        invitationId,
        revokedByUserId: req.user.id,
      });

      res.status(200).json({
        success: true,
        data: { message: "Invitation revoked successfully." },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/staff/invitations/verify
   * Verify and preview invitation token before onboarding
   */
  public static async verifyInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = ((req.query.token as string) || (req.body?.token as string) || "").trim();
      const preview = await StaffAuthService.verifyInvitationToken(token);

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/staff/invitations/accept
   * Accept an invitation and register an Officer or Admin account
   */
  public static async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = AcceptStaffInvitationSchema.parse(req.body);

      const result = await StaffAuthService.acceptInvitation({
        token: dto.token,
        name: dto.name,
        password: dto.password,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });

      // Set auth cookies for the derived role
      StaffAuthController.setStaffCookies(res, result.user.role, result.accessToken, result.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
