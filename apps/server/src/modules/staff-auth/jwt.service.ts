import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { UserRole } from "@civictrack/contracts";
import { UnauthorizedError } from "../../common/errors/app-error.js";

export interface StaffJwtPayload {
  sub: string; // User ObjectId
  email: string;
  name: string;
  role: UserRole.ADMIN | UserRole.OFFICER;
  departmentId?: string;
  sessionId: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

const JWT_ISSUER = "civictrack-api";
const JWT_AUDIENCE = "civictrack-staff";

export class JwtService {
  /**
   * Hashes a token using SHA-256 for persistent database storage
   */
  public static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Signs a short-lived access token (e.g. 15 minutes)
   */
  public static signAccessToken(params: {
    userId: string;
    email: string;
    name: string;
    role: UserRole.ADMIN | UserRole.OFFICER;
    departmentId?: string;
    sessionId: string;
  }): string {
    return jwt.sign(
      {
        sub: params.userId,
        email: params.email,
        name: params.name,
        role: params.role,
        departmentId: params.departmentId,
        sessionId: params.sessionId,
      },
      env.STAFF_JWT_ACCESS_SECRET,
      {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: env.STAFF_JWT_ACCESS_EXPIRY as any,
      }
    );
  }

  /**
   * Signs a long-lived refresh token (e.g. 7 days)
   */
  public static signRefreshToken(params: {
    userId: string;
    sessionId: string;
    role: UserRole.ADMIN | UserRole.OFFICER;
  }): string {
    return jwt.sign(
      {
        sub: params.userId,
        sessionId: params.sessionId,
        role: params.role,
      },
      env.STAFF_JWT_REFRESH_SECRET,
      {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: env.STAFF_JWT_REFRESH_EXPIRY as any,
      }
    );
  }

  /**
   * Verifies an access token signature and claims
   */
  public static verifyAccessToken(token: string): StaffJwtPayload {
    try {
      const decoded = jwt.verify(token, env.STAFF_JWT_ACCESS_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as StaffJwtPayload;

      return decoded;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new UnauthorizedError("Session has expired. Please sign in again.");
      }
      throw new UnauthorizedError("Invalid or tampered authentication token.");
    }
  }

  /**
   * Verifies a refresh token signature and claims
   */
  public static verifyRefreshToken(token: string): { sub: string; sessionId: string; role: UserRole.ADMIN | UserRole.OFFICER } {
    try {
      const decoded = jwt.verify(token, env.STAFF_JWT_REFRESH_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as { sub: string; sessionId: string; role: UserRole.ADMIN | UserRole.OFFICER };

      return decoded;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new UnauthorizedError("Refresh session has expired. Please log in again.");
      }
      throw new UnauthorizedError("Invalid refresh session token.");
    }
  }
}
