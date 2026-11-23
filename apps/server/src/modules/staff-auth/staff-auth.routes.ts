import { Router } from "express";
import { StaffAuthController } from "./staff-auth.controller.js";
import { authenticateUser } from "../identity/clerk.middleware.js";
import { requireRole } from "../identity/rbac.middleware.js";
import { UserRole } from "@civictrack/contracts";

const adminRouter = Router();
adminRouter.post("/login", StaffAuthController.adminLogin);
adminRouter.post("/register", StaffAuthController.adminRegister);
adminRouter.post("/refresh", StaffAuthController.adminRefresh);
adminRouter.post("/logout", StaffAuthController.adminLogout);
adminRouter.get("/me", authenticateUser, requireRole(UserRole.ADMIN), StaffAuthController.adminGetMe);
adminRouter.get("/verify-invite", StaffAuthController.verifyInvitation);

const officerRouter = Router();
officerRouter.post("/login", StaffAuthController.officerLogin);
officerRouter.post("/refresh", StaffAuthController.officerRefresh);
officerRouter.post("/logout", StaffAuthController.officerLogout);
officerRouter.get("/me", authenticateUser, requireRole(UserRole.OFFICER), StaffAuthController.officerGetMe);
officerRouter.get("/verify-invite", StaffAuthController.verifyInvitation);
officerRouter.post("/register", StaffAuthController.acceptInvitation);

const staffInvitationRouter = Router();
staffInvitationRouter.get("/verify", StaffAuthController.verifyInvitation);
staffInvitationRouter.post("/accept", StaffAuthController.acceptInvitation);

const adminInvitationRouter = Router();
adminInvitationRouter.use(authenticateUser, requireRole(UserRole.ADMIN));
adminInvitationRouter.post("/", StaffAuthController.adminCreateInvitation);
adminInvitationRouter.get("/", StaffAuthController.adminListInvitations);
adminInvitationRouter.post("/:id/revoke", StaffAuthController.adminRevokeInvitation);

export {
  adminRouter as adminAuthRoutes,
  officerRouter as officerAuthRoutes,
  staffInvitationRouter as staffInvitationRoutes,
  adminInvitationRouter as adminInvitationRoutes,
};
