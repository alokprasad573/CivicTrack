import { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { UserService } from "../users/user.service.js";
import { UnauthorizedError, ForbiddenError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { IAuthUser } from "./identity.types.js";

/**
 * CivicTrack Clerk Authentication Middleware
 * 
 * 1. Verifies Clerk session token using official @clerk/express getAuth.
 * 2. Rejects invalid, expired, or missing sessions (401 Unauthorized).
 * 3. Resolves the corresponding local MongoDB user.
 * 4. Just-In-Time provisions new citizens if webhook has not delivered yet.
 * 5. Rejects inactive or suspended local accounts (403 Forbidden).
 * 6. Attaches trusted user identity to req.user.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      throw new UnauthorizedError("Authentication required. Please provide a valid Clerk session.");
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
    }

    if (!user) {
      throw new UnauthorizedError("User profile is not provisioned in CivicTrack.");
    }

    // Check account status
    if (!user.isActive) {
      throw new ForbiddenError("Your CivicTrack account has been deactivated. Please contact support.");
    }

    // Attach trusted application identity to request
    const authUser: IAuthUser = {
      id: user._id.toString(),
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      isActive: user.isActive,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
}
