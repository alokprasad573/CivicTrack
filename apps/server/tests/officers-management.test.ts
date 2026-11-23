import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../src/app.js";
import { JwtService } from "../src/modules/staff-auth/jwt.service.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { DepartmentModel } from "../src/modules/departments/department.model.js";
import { ComplaintModel } from "../src/modules/complaints/complaint.model.js";
import { ComplaintStatusHistoryModel } from "../src/modules/complaints/complaint-history.model.js";
import { StaffSessionModel } from "../src/modules/staff-auth/staff-session.model.js";
import { StaffInvitationModel } from "../src/modules/staff-auth/staff-invitation.model.js";
import { NotificationModel } from "../src/modules/notifications/notification.model.js";
import { UserService } from "../src/modules/users/user.service.js";
import {
  UserRole,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
  NotificationType,
} from "@civictrack/contracts";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";

async function runOfficerManagementTests(): Promise<void> {
  console.log("Running Officer Scoping, Department Code Filtering & Safe Deletion Tests...\n");

  // =========================================================================
  // 0. OFFLINE-COMPATIBLE ASSERTIONS: HTTP Route Reachability & Validation Guards
  // =========================================================================
  console.log("0. Testing HTTP Route Reachability & Unit Validation Guards:");

  // 0a. Verify DELETE /api/v1/users/officers/:id is reachable and guarded by 401 Unauthorized
  const unauthOfficerRes = await request(app).delete("/api/v1/users/officers/6b040b2ba4e2027936af6090");
  if (unauthOfficerRes.status !== 401) {
    throw new Error(
      `Expected 401 for unauthenticated DELETE /api/v1/users/officers/:id, got ${unauthOfficerRes.status}`
    );
  }
  if (!unauthOfficerRes.body.error?.message?.includes("Authentication required")) {
    throw new Error(`Unexpected error message: ${unauthOfficerRes.body.error?.message}`);
  }
  console.log("   -> DELETE /api/v1/users/officers/:id correctly reached and rejected unauthenticated request with 401");

  // 0b. Verify REST alias DELETE /api/v1/users/:id is also reachable
  const unauthAliasRes = await request(app).delete("/api/v1/users/6b040b2ba4e2027936af6090");
  if (unauthAliasRes.status !== 401) {
    throw new Error(
      `Expected 401 for unauthenticated DELETE /api/v1/users/:id, got ${unauthAliasRes.status}`
    );
  }
  console.log("   -> DELETE /api/v1/users/:id (REST alias) correctly reached and rejected unauthenticated request with 401");

  // 0c. Verify unmapped subpath returns 404
  const unmappedRes = await request(app).delete("/api/v1/users/invalid/subpath/notfound");
  if (unmappedRes.status !== 404) {
    throw new Error(`Expected 404 for unmapped subpath, got ${unmappedRes.status}`);
  }
  console.log("   -> Non-existent route returns standard 404");

  const testAdminId = new Types.ObjectId().toString();
  const testInvalidId = "invalid_non_object_id";

  let invalidIdFailed = false;
  try {
    await UserService.deleteOfficer({
      officerId: testInvalidId,
      requestingAdminId: testAdminId,
    });
  } catch (err: any) {
    invalidIdFailed = true;
    if (!err.message.includes("Invalid officer ID format")) {
      throw new Error(`Unexpected error message for invalid ID: ${err.message}`);
    }
  }
  if (!invalidIdFailed) {
    throw new Error("FAILED: Non-ObjectId officerId must be rejected with validation error");
  }

  // Self deletion guard
  let selfDeleteFailed = false;
  try {
    await UserService.deleteOfficer({
      officerId: testAdminId,
      requestingAdminId: testAdminId,
    });
  } catch (err: any) {
    selfDeleteFailed = true;
    if (!err.message.includes("Administrators cannot delete their own account")) {
      throw new Error(`Unexpected error message for self deletion: ${err.message}`);
    }
  }
  if (!selfDeleteFailed) {
    throw new Error("FAILED: Self-deletion by admin must be rejected");
  }
  console.log("   -> Officer ID format and self-deletion checks verified offline\n");

  const connected = await connectDatabase();
  if (!connected) {
    console.log("⚠️ Database offline. Skipping live DB officer management integration tests.");
    return;
  }

  try {
    const passwordHash = await bcrypt.hash("Password@123", 10);

    // 1. Setup departments: ROADS and WATER
    let roadsDept = await DepartmentModel.findOne({ code: "TEST_ROADS" });
    if (!roadsDept) {
      roadsDept = await DepartmentModel.create({
        name: "Test Roads Department",
        code: "TEST_ROADS",
        categories: [ComplaintCategory.ROADS_POTHOLES],
        isActive: true,
      });
    }

    let waterDept = await DepartmentModel.findOne({ code: "TEST_WATER" });
    if (!waterDept) {
      waterDept = await DepartmentModel.create({
        name: "Test Water Department",
        code: "TEST_WATER",
        categories: [ComplaintCategory.WATER_SUPPLY],
        isActive: true,
      });
    }

    // 2. Setup users: Admin, Citizen, Roads Officer, Water Officer
    const adminUser = await UserModel.create({
      email: `admin.${Date.now()}@civictrack.test`,
      name: "Super Admin",
      role: UserRole.ADMIN,
      passwordHash,
      isActive: true,
    });

    // Ensure test departments are owned by the test admin
    roadsDept.createdByAdminId = adminUser._id;
    await roadsDept.save();
    waterDept.createdByAdminId = adminUser._id;
    await waterDept.save();

    const citizenUser = await UserModel.create({
      email: `citizen.${Date.now()}@civictrack.test`,
      name: "John Citizen",
      role: UserRole.CITIZEN,
      isActive: true,
    });

    const roadsOfficer = await UserModel.create({
      email: `officer.roads.${Date.now()}@civictrack.test`,
      name: "Roads Officer Dave",
      role: UserRole.OFFICER,
      departmentId: roadsDept._id,
      passwordHash,
      isActive: true,
    });

    const waterOfficer = await UserModel.create({
      email: `officer.water.${Date.now()}@civictrack.test`,
      name: "Water Officer Maya",
      role: UserRole.OFFICER,
      departmentId: waterDept._id,
      passwordHash,
      isActive: true,
    });

    console.log("1. Testing Officer Directory Scoping & Department Code Filtering:");

    // Query with role: OFFICER
    const onlyOfficers = await UserService.listUsers({ role: UserRole.OFFICER });
    const hasCitizen = onlyOfficers.users.some((u) => u.role === UserRole.CITIZEN);
    const hasAdmin = onlyOfficers.users.some((u) => u.role === UserRole.ADMIN);
    if (hasCitizen || hasAdmin) {
      throw new Error("FAILED: Directory with role: OFFICER must not include citizens or admins");
    }
    console.log("   -> Role scoping strictly isolates OFFICER accounts");

    // Query with departmentCode: "TEST_ROADS"
    const roadsOnly = await UserService.listUsers({
      role: UserRole.OFFICER,
      departmentCode: "TEST_ROADS",
    });
    const allRoads = roadsOnly.users.every(
      (u) => u.departmentId?.toString() === roadsDept!._id.toString()
    );
    if (!allRoads || !roadsOnly.users.some((u) => u._id.toString() === roadsOfficer._id.toString())) {
      throw new Error("FAILED: Department code filtering did not match expected department");
    }
    console.log("   -> Department code 'TEST_ROADS' successfully filters to matching officers");

    // Query with departmentCode: "TEST_WATER"
    const waterOnly = await UserService.listUsers({
      role: UserRole.OFFICER,
      departmentCode: "TEST_WATER",
    });
    const allWater = waterOnly.users.every(
      (u) => u.departmentId?.toString() === waterDept!._id.toString()
    );
    if (!allWater || !waterOnly.users.some((u) => u._id.toString() === waterOfficer._id.toString())) {
      throw new Error("FAILED: Department code filtering for water failed");
    }
    console.log("   -> Department code 'TEST_WATER' successfully filters to matching officers");

    // Query with non-existent departmentCode
    const emptyResult = await UserService.listUsers({
      role: UserRole.OFFICER,
      departmentCode: "NON_EXISTENT_CODE_XYZ",
    });
    if (emptyResult.users.length !== 0 || emptyResult.total !== 0) {
      throw new Error("FAILED: Non-existent department code must return 0 results");
    }
    console.log("   -> Non-existent department code correctly yields empty results\n");

    console.log("2. Testing Safe Officer Deletion Authorization & Protections (Service & HTTP Endpoints):");

    const adminSession = await StaffSessionModel.create({
      userId: adminUser._id,
      role: UserRole.ADMIN,
      refreshTokenHash: "admin_test_hash",
      userAgent: "Test Admin",
      ipAddress: "127.0.0.1",
      expiresAt: new Date(Date.now() + 86400000),
      isRevoked: false,
    });

    const roadsOfficerSession = await StaffSessionModel.create({
      userId: roadsOfficer._id,
      role: UserRole.OFFICER,
      refreshTokenHash: "officer_test_hash",
      userAgent: "Test Officer",
      ipAddress: "127.0.0.1",
      expiresAt: new Date(Date.now() + 86400000),
      isRevoked: false,
    });

    const adminToken = JwtService.signAccessToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: UserRole.ADMIN,
      sessionId: adminSession._id.toString(),
    });

    const roadsOfficerToken = JwtService.signAccessToken({
      userId: roadsOfficer._id.toString(),
      email: roadsOfficer.email,
      name: roadsOfficer.name,
      role: UserRole.OFFICER,
      departmentId: roadsDept._id.toString(),
      sessionId: roadsOfficerSession._id.toString(),
    });

    // 2a. Attempt to delete an officer without authentication (HTTP 401)
    const unauthHttpRes = await request(app)
      .delete(`/api/v1/users/officers/${roadsOfficer._id}`);
    if (unauthHttpRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated deletion, got ${unauthHttpRes.status}`);
    }
    console.log("   -> HTTP DELETE unauthenticated request rejected with 401 Unauthorized");

    // 2b. Attempt to delete an officer as another Officer (HTTP 403)
    const officerHttpRes = await request(app)
      .delete(`/api/v1/users/officers/${waterOfficer._id}`)
      .set("Authorization", `Bearer ${roadsOfficerToken}`);
    if (officerHttpRes.status !== 403) {
      throw new Error(`Expected 403 for officer deleting officer, got ${officerHttpRes.status}`);
    }
    console.log("   -> HTTP DELETE by non-admin Officer rejected with 403 Forbidden");

    // 2c. Attempt to delete a non-officer (CITIZEN) via admin HTTP request (HTTP 403)
    const nonOfficerHttpRes = await request(app)
      .delete(`/api/v1/users/officers/${citizenUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    if (nonOfficerHttpRes.status !== 403) {
      throw new Error(`Expected 403 for deleting citizen account, got ${nonOfficerHttpRes.status}`);
    }
    console.log("   -> HTTP DELETE non-officer (Citizen) by Admin rejected with 403 Forbidden");

    // 2d. Attempt admin self-deletion via HTTP request (HTTP 403)
    const selfHttpRes = await request(app)
      .delete(`/api/v1/users/officers/${adminUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    if (selfHttpRes.status !== 403) {
      throw new Error(`Expected 403 for admin self deletion, got ${selfHttpRes.status}`);
    }
    console.log("   -> HTTP DELETE admin self-deletion rejected with 403 Forbidden");

    // 2e. Attempt invalid ID format via HTTP request (HTTP 400)
    const invalidFormatHttpRes = await request(app)
      .delete("/api/v1/users/officers/invalid-non-id")
      .set("Authorization", `Bearer ${adminToken}`);
    if (invalidFormatHttpRes.status !== 400) {
      throw new Error(`Expected 400 for invalid ID format, got ${invalidFormatHttpRes.status}`);
    }
    console.log("   -> HTTP DELETE with invalid ID format rejected with 400 Bad Request");

    // Attempt to delete a CITIZEN via deleteOfficer service directly
    let citizenDeleteFailed = false;
    try {
      await UserService.deleteOfficer({
        officerId: citizenUser._id.toString(),
        requestingAdminId: adminUser._id.toString(),
      });
    } catch (err: any) {
      citizenDeleteFailed = true;
      if (!err.message.includes("Only accounts with the OFFICER role can be deleted")) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!citizenDeleteFailed) {
      throw new Error("FAILED: Citizen accounts must not be deletable through deleteOfficer");
    }
    console.log("   -> Direct Service Non-officer (Citizen) deletion strictly blocked with 403 Forbidden");

    // Attempt to delete an ADMIN via deleteOfficer service directly
    let adminDeleteFailed = false;
    try {
      await UserService.deleteOfficer({
        officerId: adminUser._id.toString(),
        requestingAdminId: adminUser._id.toString(),
      });
    } catch (err: any) {
      adminDeleteFailed = true;
    }
    if (!adminDeleteFailed) {
      throw new Error("FAILED: Admin accounts must not be deletable through deleteOfficer");
    }
    console.log("   -> Direct Service Admin account deletion strictly blocked\n");

    console.log("3. Testing Referential Integrity on Officer Deletion:");

    // Create staff session for roadsOfficer
    await StaffSessionModel.create({
      userId: roadsOfficer._id,
      role: UserRole.OFFICER,
      refreshTokenHash: "mock_hash",
      userAgent: "Test Runner",
      ipAddress: "127.0.0.1",
      expiresAt: new Date(Date.now() + 86400000),
      isRevoked: false,
    });

    // Create pending invitation for roadsOfficer email
    await StaffInvitationModel.create({
      email: roadsOfficer.email,
      role: UserRole.OFFICER,
      departmentId: roadsDept._id,
      tokenHash: "test_invite_token_hash",
      invitedBy: adminUser._id,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Create assigned complaint
    const assignedComplaint = await ComplaintModel.create({
      referenceNumber: `CT-DEL-${Date.now()}`,
      title: "Pothole on Main St",
      description: "Severe road damage with dangerous deep craters causing accidents",
      category: ComplaintCategory.ROADS_POTHOLES,
      citizenId: citizenUser._id,
      status: ComplaintStatus.ASSIGNED,
      priority: ComplaintPriority.HIGH,
      departmentId: roadsDept._id,
      assignedOfficerId: roadsOfficer._id,
      location: {
        type: "Point",
        coordinates: [77.5946, 12.9716],
      },
      address: "MG Road Signal, Ward 1",
    });

    // Create complaint status history with roadsOfficer as actor
    await ComplaintStatusHistoryModel.create({
      complaintId: assignedComplaint._id,
      fromStatus: ComplaintStatus.VERIFIED,
      toStatus: ComplaintStatus.ASSIGNED,
      actorId: roadsOfficer._id,
      remarks: "Officer assigned by supervisor",
    });

    // Create notification for roadsOfficer
    await NotificationModel.create({
      recipientId: roadsOfficer._id,
      type: NotificationType.COMPLAINT_ASSIGNED,
      title: "New Incident Assigned",
      message: "You have been assigned an incident",
      resourceType: "COMPLAINT",
      resourceId: assignedComplaint._id.toString(),
    });

    // Now execute safe officer deletion via HTTP DELETE /api/v1/users/officers/:id
    const deleteHttpRes = await request(app)
      .delete(`/api/v1/users/officers/${roadsOfficer._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    if (deleteHttpRes.status !== 200 || !deleteHttpRes.body.success) {
      throw new Error(
        `Expected 200 for HTTP officer deletion, got ${deleteHttpRes.status}: ${JSON.stringify(deleteHttpRes.body)}`
      );
    }
    const deleteResult = deleteHttpRes.body.data;

    if (deleteResult.affectedComplaintsCount !== 1) {
      throw new Error(`Expected 1 affected complaint, got ${deleteResult.affectedComplaintsCount}`);
    }
    console.log("   -> HTTP DELETE /api/v1/users/officers/:id succeeded with 200 OK");

    // Also verify REST alias DELETE /api/v1/users/:id works for waterOfficer
    const aliasDeleteRes = await request(app)
      .delete(`/api/v1/users/${waterOfficer._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    if (aliasDeleteRes.status !== 200 || !aliasDeleteRes.body.success) {
      throw new Error(`Expected 200 for HTTP alias deletion, got ${aliasDeleteRes.status}`);
    }
    console.log("   -> HTTP DELETE /api/v1/users/:id (REST alias) succeeded with 200 OK");

    // Verify officer record deleted
    const deletedUser = await UserModel.findById(roadsOfficer._id);
    if (deletedUser) {
      throw new Error("FAILED: Officer record was not deleted from database");
    }
    console.log("   -> Officer user record deleted successfully");

    // Verify assigned complaint preserved and assignedOfficerId unassigned
    const updatedComplaint = await ComplaintModel.findById(assignedComplaint._id);
    if (!updatedComplaint) {
      throw new Error("FAILED: Complaint was mistakenly deleted!");
    }
    if (updatedComplaint.assignedOfficerId) {
      throw new Error("FAILED: assignedOfficerId was not unassigned on the complaint");
    }
    if (updatedComplaint.departmentId?.toString() !== roadsDept._id.toString()) {
      throw new Error("FAILED: departmentId on complaint was corrupted");
    }
    console.log("   -> Complaint record preserved intact with assignedOfficerId safely unlinked");

    // Verify status history preserved
    const historyCount = await ComplaintStatusHistoryModel.countDocuments({
      complaintId: assignedComplaint._id,
    });
    if (historyCount !== 1) {
      throw new Error("FAILED: Status history audit log was not preserved!");
    }
    console.log("   -> Audit trail and status history preserved for municipal transparency");

    // Verify staff sessions revoked/deleted
    const sessionCount = await StaffSessionModel.countDocuments({
      userId: roadsOfficer._id,
    });
    if (sessionCount !== 0) {
      throw new Error("FAILED: Active staff sessions were not cleaned up");
    }
    console.log("   -> Active staff sessions cleaned up");

    // Verify pending invitations revoked
    const pendingInvites = await StaffInvitationModel.find({
      email: roadsOfficer.email,
    });
    if (pendingInvites.some((inv) => inv.status === "PENDING")) {
      throw new Error("FAILED: Pending invitations were not revoked");
    }
    console.log("   -> Pending invitations revoked");

    // Cleanup test records
    await ComplaintStatusHistoryModel.deleteMany({ complaintId: assignedComplaint._id });
    await ComplaintModel.deleteOne({ _id: assignedComplaint._id });
    await NotificationModel.deleteMany({ recipientId: roadsOfficer._id });
    await UserModel.deleteMany({ _id: { $in: [adminUser._id, citizenUser._id, waterOfficer._id] } });
    await DepartmentModel.deleteMany({ _id: { $in: [roadsDept._id, waterDept._id] } });

    console.log("\nAll Officer Management, Scoping & Deletion tests passed successfully!\n");
  } finally {
    await disconnectDatabase();
  }
}

runOfficerManagementTests().catch((err) => {
  console.error("Officer Management test failed:", err);
  process.exit(1);
});
