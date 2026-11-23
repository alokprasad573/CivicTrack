import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { verifyToken, clerkClient } from "@clerk/express";
import { Types } from "mongoose";
import { env } from "./config/env.js";
import { logger } from "./common/utils/logger.js";
import { UserService } from "./modules/users/user.service.js";
import { UserModel } from "./modules/users/user.model.js";
import { JwtService } from "./modules/staff-auth/jwt.service.js";
import {
  INotification,
  SocketEvent,
  UserRole,
  ComplaintCreatedPayload,
  ComplaintStatusUpdatedPayload,
  ComplaintAssignedPayload,
  DashboardStatsUpdatedPayload,
} from "@civictrack/contracts";

export interface SocketUser {
  id: string;
  clerkUserId?: string;
  role: UserRole;
  departmentId?: string;
}

declare module "socket.io" {
  interface SocketData {
    user?: SocketUser;
  }
}

let io: Server | null = null;

export function getIO(): Server | null {
  return io;
}

/**
 * Disconnect all active socket connections belonging to a user (used upon logout / session revocation)
 */
export function disconnectUserSockets(userId: string): void {
  if (!io) return;
  try {
    io.in(`user:${userId}`).disconnectSockets(true);
    logger.info("Disconnected user sockets on logout/revocation", { userId });
  } catch (err) {
    logger.error("Failed to disconnect user sockets", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx !== -1) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Verify whether an authenticated socket user has authorization to join a specific room
 */
export async function authorizeRoomJoin(user: SocketUser, room: string): Promise<boolean> {
  // 1. Personal room: only user's own room
  if (room === `user:${user.id}`) {
    return true;
  }

  // 2. Role rooms
  if (room === "role:admin" || room === "admin:notifications") {
    return user.role === UserRole.ADMIN;
  }
  if (room === "role:officer") {
    return user.role === UserRole.OFFICER;
  }
  if (room === "role:citizen") {
    return user.role === UserRole.CITIZEN;
  }

  // 3. Department rooms: dept:<departmentId>
  if (room.startsWith("dept:")) {
    const deptId = room.substring(5);
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.OFFICER && user.departmentId === deptId) return true;
    return false;
  }

  // 4. Complaint rooms: complaint:<complaintId>
  if (room.startsWith("complaint:")) {
    const complaintId = room.substring(10);
    if (user.role === UserRole.ADMIN) return true;

    try {
      if (!Types.ObjectId.isValid(complaintId)) return false;
      const { ComplaintModel } = await import("./modules/complaints/complaint.model.js");
      if (ComplaintModel.db.readyState !== 1) {
        return user.role === UserRole.OFFICER || user.role === UserRole.CITIZEN;
      }
      const complaint = await ComplaintModel.findById(complaintId).select("citizenId departmentId assignedOfficerId");
      if (!complaint) return false;

      if (user.role === UserRole.CITIZEN) {
        return complaint.citizenId.toString() === user.id;
      }
      if (user.role === UserRole.OFFICER) {
        return (
          complaint.assignedOfficerId?.toString() === user.id ||
          (Boolean(user.departmentId) && complaint.departmentId?.toString() === user.departmentId) ||
          !complaint.departmentId
        );
      }
    } catch {
      return false;
    }
    return false;
  }

  // Any other arbitrary room name is forbidden
  return false;
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: [env.CLIENT_URL],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Socket.io Handshake Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.substring(7)
          : undefined;
      const explicitToken =
        (socket.handshake.auth?.token as string | undefined) || bearerToken;

      const cookies = parseCookies(socket.handshake.headers.cookie);
      const adminCookieToken = cookies["civictrack_admin_token"];
      const officerCookieToken = cookies["civictrack_officer_token"];

      // Priority list of candidate tokens: explicit token, admin cookie, officer cookie
      const candidateTokens = [explicitToken, adminCookieToken, officerCookieToken].filter(
        (t): t is string => Boolean(t && typeof t === "string" && t.trim().length > 0)
      );

      if (candidateTokens.length === 0) {
        logger.warn("Socket connection rejected: No authentication token or session cookie provided", {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        return next(new Error("Authentication token required"));
      }

      let authenticatedUser: SocketUser | null = null;

      // 1. Try Staff JWT verification across candidate tokens
      for (const token of candidateTokens) {
        if (token.startsWith("test-token-")) continue;

        try {
          const staffPayload = JwtService.verifyAccessToken(token);
          const userDoc = await UserModel.findById(staffPayload.sub);
          if (userDoc && userDoc.isActive && userDoc.role === staffPayload.role) {
            authenticatedUser = {
              id: userDoc._id.toString(),
              role: userDoc.role,
              departmentId: userDoc.departmentId ? userDoc.departmentId.toString() : undefined,
            };
            break;
          }
        } catch {
          // Token is not a valid staff JWT, proceed to fallback
        }
      }

      // 2. If not authenticated via Staff JWT, check test tokens or Clerk session
      if (!authenticatedUser) {
        for (const token of candidateTokens) {
          if (token.startsWith("test-token-")) {
            // Test token bypass strictly forbidden in production
            if (env.NODE_ENV === "production" || process.env.ALLOW_TEST_TOKEN_AUTH !== "true") {
              logger.warn("Socket handshake rejected: test-token auth is strictly forbidden in production", {
                ip: socket.handshake.address,
              });
              return next(new Error("Test-token authentication is disabled in production"));
            }

            const tokenIdentifier = token.replace("test-token-", "");
            let user = await UserService.findByClerkUserId(tokenIdentifier);
            if (!user && Types.ObjectId.isValid(tokenIdentifier)) {
              user = await UserModel.findById(tokenIdentifier);
            }
            if (user && user.isActive) {
              authenticatedUser = {
                id: user._id.toString(),
                clerkUserId: user.clerkUserId,
                role: user.role,
                departmentId: user.departmentId ? user.departmentId.toString() : undefined,
              };
              break;
            }
          } else {
            try {
              const claims = await verifyToken(token, {
                secretKey: env.CLERK_SECRET_KEY,
              });
              const clerkUserId = claims.sub;

              if (clerkUserId) {
                let user = await UserService.findByClerkUserId(clerkUserId);

                // JIT provision user if not yet in database
                if (!user) {
                  try {
                    const clerkUser = await clerkClient.users.getUser(clerkUserId);
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
                        clerkUserId,
                        email: primaryEmail,
                        name: fullName,
                      });
                    }
                  } catch (clerkErr) {
                    logger.warn("Could not JIT provision socket user from Clerk API", {
                      clerkUserId,
                      error: clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
                    });
                  }

                  // Concurrency fallback: In case another concurrent request or HTTP call provisioned the user
                  if (!user) {
                    user = await UserService.findByClerkUserId(clerkUserId);
                  }
                }

                if (user && user.isActive) {
                  authenticatedUser = {
                    id: user._id.toString(),
                    clerkUserId: user.clerkUserId,
                    role: user.role,
                    departmentId: user.departmentId ? user.departmentId.toString() : undefined,
                  };
                  break;
                }
              }
            } catch {
              // Token is not a valid Clerk token
            }
          }
        }
      }

      if (!authenticatedUser) {
        logger.warn("Socket connection rejected: Invalid or unverified credentials", {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        return next(new Error("Invalid authentication credentials"));
      }

      // Attach verified identity to socket instance
      socket.data.user = authenticatedUser;
      next();
    } catch (err) {
      const isDbError =
        err instanceof Error &&
        (err.name.includes("Mongo") ||
          err.message.includes("database") ||
          err.message.includes("timed out") ||
          err.message.includes("whitelist") ||
          err.message.includes("tlsv1 alert"));

      if (isDbError) {
        logger.warn("Socket handshake deferred: Database is temporarily unavailable", {
          error: err instanceof Error ? err.message : String(err),
          socketId: socket.id,
        });
        next(new Error("Database temporarily unavailable"));
      } else {
        logger.error("Unexpected error in socket authentication middleware", {
          error: err instanceof Error ? err.message : String(err),
        });
        next(new Error("Authentication server error"));
      }
    }
  });

  // Client Connection & Server-Controlled Room Authorization
  io.on("connection", (socket: Socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Server-controlled rooms strictly derived from verified identity (prevents privilege escalation)
    const personalRoom = `user:${user.id}`;
    socket.join(personalRoom);

    const roleRoom = `role:${user.role.toLowerCase()}`;
    socket.join(roleRoom);

    if (user.role === UserRole.ADMIN) {
      socket.join("role:admin");
      socket.join("admin:notifications");
    }

    if (user.departmentId) {
      const deptRoom = `dept:${user.departmentId}`;
      socket.join(deptRoom);
    }

    logger.info("Socket client connected and authorized", {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
      departmentId: user.departmentId,
    });

    // Explicit room join authorization listener
    socket.on("join", async (room: unknown, ack?: (res: { success: boolean; error?: string }) => void) => {
      if (typeof room !== "string") {
        if (ack) ack({ success: false, error: "Invalid room identifier" });
        return;
      }

      const isAuthorized = await authorizeRoomJoin(user, room);
      if (isAuthorized) {
        socket.join(room);
        logger.info("Socket client joined authorized room", {
          socketId: socket.id,
          userId: user.id,
          room,
        });
        if (ack) ack({ success: true });
      } else {
        logger.warn("Socket client attempted unauthorized room join", {
          socketId: socket.id,
          userId: user.id,
          role: user.role,
          room,
        });
        socket.emit("error", { message: "Unauthorized room join", room });
        if (ack) ack({ success: false, error: "Unauthorized room access denied" });
      }
    });

    socket.on("leave", (room: unknown) => {
      if (typeof room === "string") {
        socket.leave(room);
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("Socket client disconnected", {
        socketId: socket.id,
        userId: user.id,
        reason,
      });
    });
  });

  return io;
}

/**
 * Emit a persisted notification to a user's private room
 */
export function emitNotification(recipientId: string, notification: INotification): void {
  if (!io) return;
  try {
    io.to(`user:${recipientId}`).emit(SocketEvent.NOTIFICATION_NEW, notification);
    logger.debug("Socket notification emitted", {
      recipientId,
      notificationId: notification._id,
      type: notification.type,
    });
  } catch (err) {
    logger.error("Failed to emit socket notification", {
      error: err instanceof Error ? err.message : String(err),
      recipientId,
    });
  }
}

/**
 * Emit a complaint creation event to citizen, admins, and department
 */
export function emitComplaintCreated(payload: ComplaintCreatedPayload): void {
  if (!io) return;
  try {
    const event = SocketEvent.COMPLAINT_CREATED;
    // Notify owner citizen
    io.to(`user:${payload.citizenId}`).emit(event, payload);
    // Notify admins for live triage intake
    io.to("role:admin").emit(event, payload);
    // Notify assigned department if set
    if (payload.departmentId) {
      io.to(`dept:${payload.departmentId}`).emit(event, payload);
    }
    // Notify complaint details room
    io.to(`complaint:${payload.complaintId}`).emit(event, payload);
  } catch (err) {
    logger.error("Failed to emit complaint created event", {
      error: err instanceof Error ? err.message : String(err),
      complaintId: payload.complaintId,
    });
  }
}

/**
 * Emit a complaint status update event to citizen, admins, department, and complaint room
 */
export function emitComplaintStatusUpdated(payload: ComplaintStatusUpdatedPayload): void {
  if (!io) return;
  try {
    const event = SocketEvent.COMPLAINT_STATUS_UPDATED;
    // Notify owner citizen
    io.to(`user:${payload.citizenId}`).emit(event, payload);
    // Notify admins
    io.to("role:admin").emit(event, payload);
    // Notify department
    if (payload.departmentId) {
      io.to(`dept:${payload.departmentId}`).emit(event, payload);
    }
    // Notify assigned officer
    if (payload.assignedOfficerId) {
      io.to(`user:${payload.assignedOfficerId}`).emit(event, payload);
    }
    // Notify complaint details subscribers
    io.to(`complaint:${payload.complaintId}`).emit(event, payload);
  } catch (err) {
    logger.error("Failed to emit complaint status update event", {
      error: err instanceof Error ? err.message : String(err),
      complaintId: payload.complaintId,
    });
  }
}

/**
 * Emit a complaint assigned event to department, officer, citizen, admins, and complaint room
 */
export function emitComplaintAssigned(payload: ComplaintAssignedPayload): void {
  if (!io) return;
  try {
    const event = SocketEvent.COMPLAINT_ASSIGNED;
    io.to(`dept:${payload.departmentId}`).emit(event, payload);
    io.to("role:admin").emit(event, payload);
    if (payload.assignedOfficerId) {
      io.to(`user:${payload.assignedOfficerId}`).emit(event, payload);
    }
    if (payload.citizenId) {
      io.to(`user:${payload.citizenId}`).emit(event, payload);
    }
    io.to(`complaint:${payload.complaintId}`).emit(event, payload);
  } catch (err) {
    logger.error("Failed to emit complaint assigned event", {
      error: err instanceof Error ? err.message : String(err),
      complaintId: payload.complaintId,
    });
  }
}

/**
 * Emit live dashboard stats update event
 */
export function emitDashboardStatsUpdated(payload: DashboardStatsUpdatedPayload): void {
  if (!io) return;
  try {
    const event = SocketEvent.DASHBOARD_STATS_UPDATED;
    if (payload.scope === "ADMIN") {
      io.to("role:admin").emit(event, payload);
    } else if (payload.scope === "OFFICER" && payload.departmentId) {
      io.to(`dept:${payload.departmentId}`).emit(event, payload);
    } else if (payload.userId) {
      io.to(`user:${payload.userId}`).emit(event, payload);
    }
  } catch (err) {
    logger.error("Failed to emit dashboard stats updated event", {
      error: err instanceof Error ? err.message : String(err),
      scope: payload.scope,
    });
  }
}
