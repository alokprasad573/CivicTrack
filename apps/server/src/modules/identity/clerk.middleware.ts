import { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { UserService } from "../users/user.service.js";
import { UserModel } from "../users/user.model.js";
import { StaffSessionModel } from "../staff-auth/staff-session.model.js";
import { JwtService } from "../staff-auth/jwt.service.js";
import { UnauthorizedError, ForbiddenError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { UserRole } from "@civictrack/contracts";

/**
 * Unified CivicTrack Authentication Resolver
 * 
 * Transparently supports:
 * 1. Staff Custom JWT (Admin & Officer): Extracted from HttpOnly cookies or Bearer token.
 * 2. Citizen Clerk Session: Extracted and cryptographically verified via Clerk SDK.
 * 3. Enforces user isActive status from local MongoDB.
 * 4. Attaches trusted user identity to req.user.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check for Staff JWT in cookies or Authorization header
    const adminToken = req.cookies?.civictrack_admin_token;
    const officerToken = req.cookies?.civictrack_officer_token;
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7).trim()
        : undefined;

    // Determine candidate staff token (admin cookie, officer cookie, or bearer)
    const staffCandidateToken = adminToken || officerToken || bearerToken;

    if (staffCandidateToken) {
      try {
        const claims = JwtService.verifyAccessToken(staffCandidateToken);

        if (claims.role === UserRole.ADMIN || claims.role === UserRole.OFFICER || claims.role === UserRole.CITIZEN) {
          // Immediately reject revoked or expired staff sessions
          if (claims.sessionId && StaffSessionModel.db.readyState === 1) {
            const session = await StaffSessionModel.findById(claims.sessionId).lean();
            if (!session || (session as any).isRevoked || new Date((session as any).expiresAt) < new Date()) {
              throw new UnauthorizedError("Session has been revoked or expired. Please sign in again.");
            }
          }

          const user = await UserModel.findById(claims.sub).lean();

          if (!user) {
            logger.warn("User account not found during staff authentication", {
              sub: claims.sub,
              claimsEmail: claims.email,
              claimsRole: claims.role,
            });
            throw new UnauthorizedError("User account not found.");
          }

          if (!user.isActive) {
            throw new ForbiddenError("Your account has been deactivated.");
          }

          if (user.role !== claims.role) {
            throw new ForbiddenError("Role mismatch.");
          }

          req.user = {
            id: user._id.toString(),
            clerkUserId: user.clerkUserId,
            email: user.email,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId ? user.departmentId.toString() : undefined,
            isActive: user.isActive,
          };

          return next();
        }
      } catch (staffErr: any) {
        // If Bearer token was a Clerk token, don't halt here; let Clerk getAuth inspect it
        if (staffCandidateToken !== bearerToken) {
          throw staffErr;
        }
      }
    }

    // 2. Fallback to Clerk Session (for Citizens)
    let auth: { userId: string | null } | null = null;
    try {
      auth = getAuth(req);
    } catch {
      // Ignored if Clerk was not passed in request
    }

    if (!auth || !auth.userId) {
      throw new UnauthorizedError("Authentication required. Please provide a valid session.");
    }

    // Resolve local MongoDB user
    let user = await UserService.findByClerkUserId(auth.userId);

    // If local user record does not exist yet, JIT synchronize from Clerk API
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const primaryEmail =
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
            ?.emailAddress ||
          clerkUser.emailAddresses[0]?.emailAddress ||
          "";

        const fullName =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
          clerkUser.username ||
          primaryEmail.split("@")[0] ||
          "Citizen";

        if (primaryEmail) {
          user = await UserService.syncFromClerk({
            clerkUserId: auth.userId,
            email: primaryEmail,
            name: fullName,
          });
        }
      } catch (clerkErr) {
        logger.warn("Could not JIT provision user from Clerk API", {
          clerkUserId: auth.userId,
          error: clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
        });
      }

      // Concurrency fallback: In case another concurrent request or socket handshake provisioned the user
      if (!user) {
        user = await UserService.findByClerkUserId(auth.userId);
      }
    }

    if (!user) {
      throw new UnauthorizedError("User profile is not provisioned in CivicTrack.");
    }

    // Check account status
    if (!user.isActive) {
      throw new ForbiddenError("Your CivicTrack account has been deactivated. Please contact support.");
    }

    // Attach trusted application identity to request
    req.user = {
      id: user._id.toString(),
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional CivicTrack Authentication Resolver
 * Populates req.user if a valid token is present; otherwise proceeds unauthenticated.
 */
export async function optionalAuthenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authenticateUser(req, res, () => {
      next();
    });
  } catch {
    // Silently continue without authenticated user context
    next();
  }
}
