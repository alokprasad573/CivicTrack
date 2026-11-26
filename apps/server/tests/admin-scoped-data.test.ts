import { Types } from "mongoose";
import request from "supertest";
import { app } from "../src/app.js";
import { JwtService } from "../src/modules/staff-auth/jwt.service.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { DepartmentModel } from "../src/modules/departments/department.model.js";
import { StaffSessionModel } from "../src/modules/staff-auth/staff-session.model.js";
import { DepartmentService } from "../src/modules/departments/department.service.js";
import { UserService } from "../src/modules/users/user.service.js";
import { StaffAuthService } from "../src/modules/staff-auth/staff-auth.service.js";
import { UserRole, ComplaintCategory } from "@civictrack/contracts";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";

async function runAdminScopedDataTests(): Promise<void> {
  console.log("Running Admin Scoped Data Access & Ownership Isolation Tests...\n");

  // =========================================================================
  // 1. OFFLINE-COMPATIBLE SERVICE LOGIC & VALIDATION ASSERTIONS
  // =========================================================================
  console.log("1. Testing Service-Level Scoping & Ownership Validation Guards:");

  const mockAdmin1Id = new Types.ObjectId().toString();
  const mockAdmin2Id = new Types.ObjectId().toString();

  // 1a. Department Service ownership check for update and delete
  let updateCrossAdminFailed = false;
  try {
    // If DB is offline, DepartmentService handles it safely or rejects
    await DepartmentService.update(
      new Types.ObjectId().toString(),
      { name: "Hacked Dept" },
      mockAdmin1Id
    );
  } catch (err: any) {
    updateCrossAdminFailed = true;
    console.log("   -> DepartmentService.update correctly throws error on non-existent/cross-admin dept:", err.message);
  }
  if (!updateCrossAdminFailed) {
    throw new Error("FAILED: DepartmentService.update must enforce existence and ownership.");
  }

  // 1b. Department Service officer listing cross-admin check
  let listOfficersCrossAdminFailed = false;
  try {
    await DepartmentService.listOfficers(new Types.ObjectId().toString(), mockAdmin1Id);
  } catch (err: any) {
    listOfficersCrossAdminFailed = true;
    console.log("   -> DepartmentService.listOfficers correctly guards cross-admin access:", err.message);
  }
  if (!listOfficersCrossAdminFailed && DepartmentModel.db.readyState === 1) {
    throw new Error("FAILED: DepartmentService.listOfficers must reject cross-admin queries.");
  }

  // =========================================================================
  // 2. LIVE DATABASE INTEGRATION & END-TO-END HTTP TESTS
  // =========================================================================
  const isDbConnected = await connectDatabase();
  if (!isDbConnected) {
    console.warn("MongoDB is offline or unreachable in this test environment. Skipping live end-to-end assertions.");
    return;
  }

  console.log("\n2. Live MongoDB End-to-End Admin Scoping Tests:");

  const testSuffix = Date.now().toString().slice(-6);

  // Helper to establish an authentic admin session with signed token
  async function createAdminWithToken(name: string, email: string) {
    const admin = await UserModel.create({
      email: email.toLowerCase(),
      name,
      role: UserRole.ADMIN,
      passwordHash: "mock_hash",
      isActive: true,
    });

    const session = await StaffSessionModel.create({
      userId: admin._id,
      role: UserRole.ADMIN,
      refreshTokenHash: "mock_refresh_hash",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const token = JwtService.signAccessToken({
      userId: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      role: UserRole.ADMIN,
      sessionId: session._id.toString(),
    });

    return { admin, token };
  }

  // Create Admin A and Admin B
  const { admin: adminA, token: tokenA } = await createAdminWithToken(
    "Administrator Alpha",
    `admin.alpha.${testSuffix}@civictrack.gov`
  );
  const { admin: adminB, token: tokenB } = await createAdminWithToken(
    "Administrator Beta",
    `admin.beta.${testSuffix}@civictrack.gov`
  );

  console.log(`   -> Created Admin A (${adminA.email}) and Admin B (${adminB.email})`);

  try {
    // 2a. Admin A creates Department A
    const deptACode = `DPTA${testSuffix.slice(-4)}`;
    const createDeptARes = await request(app)
      .post("/api/v1/departments")
      .set("Cookie", `civictrack_admin_token=${tokenA}`)
      .send({
        name: `Department Alpha ${testSuffix}`,
        code: deptACode,
        categories: [ComplaintCategory.ROADS_POTHOLES],
      });

    if (createDeptARes.status !== 201 || !createDeptARes.body.data?._id) {
      throw new Error(`Failed to create Department A: ${JSON.stringify(createDeptARes.body)}`);
    }
    const deptAId = createDeptARes.body.data._id;
    console.log(`   -> Admin A created Department A (${deptACode}, ID: ${deptAId})`);

    // Verify Department A has createdByAdminId set to Admin A
    const savedDeptA = await DepartmentModel.findById(deptAId);
    if (!savedDeptA || savedDeptA.createdByAdminId?.toString() !== adminA._id.toString()) {
      throw new Error(`Department A createdByAdminId mismatch. Expected ${adminA._id}, got ${savedDeptA?.createdByAdminId}`);
    }
    console.log("   -> Verified Department A saved with createdByAdminId = Admin A ID");

    // 2b. Admin B creates Department B
    const deptBCode = `DPTB${testSuffix.slice(-4)}`;
    const createDeptBRes = await request(app)
      .post("/api/v1/departments")
      .set("Cookie", `civictrack_admin_token=${tokenB}`)
      .send({
        name: `Department Beta ${testSuffix}`,
        code: deptBCode,
        categories: [ComplaintCategory.WATER_SUPPLY],
      });

    if (createDeptBRes.status !== 201 || !createDeptBRes.body.data?._id) {
      throw new Error(`Failed to create Department B: ${JSON.stringify(createDeptBRes.body)}`);
    }
    const deptBId = createDeptBRes.body.data._id;
    console.log(`   -> Admin B created Department B (${deptBCode}, ID: ${deptBId})`);

    // 2c. Department Listing Scoping:
    // Admin A requests /api/v1/departments -> sees Department A, does NOT see Department B
    const listDeptARes = await request(app)
      .get("/api/v1/departments")
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (listDeptARes.status !== 200) {
      throw new Error(`Admin A failed to list departments: ${listDeptARes.status}`);
    }
    const deptAListCodes = listDeptARes.body.data.map((d: any) => d.code);
    if (!deptAListCodes.includes(deptACode)) {
      throw new Error(`Admin A cannot see their own Department A (${deptACode})`);
    }
    if (deptAListCodes.includes(deptBCode)) {
      throw new Error(`LEAK: Admin A can see Department B (${deptBCode}) created by Admin B!`);
    }
    console.log("   -> Admin A department list correctly scoped: includes Dept A, excludes Dept B");

    // Admin B requests /api/v1/departments -> sees Department B, does NOT see Department A
    const listDeptBRes = await request(app)
      .get("/api/v1/departments")
      .set("Cookie", `civictrack_admin_token=${tokenB}`);

    const deptBListCodes = listDeptBRes.body.data.map((d: any) => d.code);
    if (!deptBListCodes.includes(deptBCode)) {
      throw new Error(`Admin B cannot see their own Department B (${deptBCode})`);
    }
    if (deptBListCodes.includes(deptACode)) {
      throw new Error(`LEAK: Admin B can see Department A (${deptACode}) created by Admin A!`);
    }
    console.log("   -> Admin B department list correctly scoped: includes Dept B, excludes Dept A");

    // 2d. Direct Department Access Endpoint Protection:
    // Admin A attempts to access GET /api/v1/departments/:deptBId -> must be 403 Forbidden
    const crossDeptGetRes = await request(app)
      .get(`/api/v1/departments/${deptBId}`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (crossDeptGetRes.status !== 403) {
      throw new Error(`Expected 403 when Admin A accesses Dept B details, got ${crossDeptGetRes.status}`);
    }
    console.log("   -> GET /api/v1/departments/:deptBId rejected Admin A with 403 Forbidden");

    // Admin A attempts to modify PATCH /api/v1/departments/:deptBId -> must be 403 Forbidden
    const crossDeptPatchRes = await request(app)
      .patch(`/api/v1/departments/${deptBId}`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`)
      .send({ name: "Admin A Takeover" });

    if (crossDeptPatchRes.status !== 403) {
      throw new Error(`Expected 403 when Admin A modifies Dept B, got ${crossDeptPatchRes.status}`);
    }
    console.log("   -> PATCH /api/v1/departments/:deptBId rejected Admin A with 403 Forbidden");

    // Admin A attempts to delete DELETE /api/v1/departments/:deptBId -> must be 403 Forbidden
    const crossDeptDeleteRes = await request(app)
      .delete(`/api/v1/departments/${deptBId}`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (crossDeptDeleteRes.status !== 403) {
      throw new Error(`Expected 403 when Admin A deletes Dept B, got ${crossDeptDeleteRes.status}`);
    }
    console.log("   -> DELETE /api/v1/departments/:deptBId rejected Admin A with 403 Forbidden");

    // Admin A attempts to view officers in Department B -> must be 403 Forbidden
    const crossDeptOfficersRes = await request(app)
      .get(`/api/v1/departments/${deptBId}/officers`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (crossDeptOfficersRes.status !== 403) {
      throw new Error(`Expected 403 when Admin A views Dept B officers, got ${crossDeptOfficersRes.status}`);
    }
    console.log("   -> GET /api/v1/departments/:deptBId/officers rejected Admin A with 403 Forbidden");

    // 2e. Officer Assignment & Cross-Admin Protection:
    // Create Officer A in Department A and Officer B in Department B
    const officerA = await UserModel.create({
      email: `officer.a.${testSuffix}@civictrack.gov`,
      name: `Officer A ${testSuffix}`,
      role: UserRole.OFFICER,
      departmentId: new Types.ObjectId(deptAId),
      isActive: true,
    });

    const officerB = await UserModel.create({
      email: `officer.b.${testSuffix}@civictrack.gov`,
      name: `Officer B ${testSuffix}`,
      role: UserRole.OFFICER,
      departmentId: new Types.ObjectId(deptBId),
      isActive: true,
    });
    console.log(`   -> Created Officer A in Dept A and Officer B in Dept B`);

    // Admin A attempts to invite an officer into Department B -> 403 Forbidden
    let crossInviteFailed = false;
    try {
      await StaffAuthService.createInvitation({
        email: `new.officer.${testSuffix}@civictrack.gov`,
        role: UserRole.OFFICER,
        departmentId: deptBId,
        invitedByUserId: adminA._id.toString(),
      });
    } catch (err: any) {
      crossInviteFailed = true;
      if (!err.message?.includes("You can only assign officers to departments you created")) {
        throw new Error(`Unexpected error message for cross-admin invite: ${err.message}`);
      }
    }
    if (!crossInviteFailed) {
      throw new Error("FAILED: Admin A must not be allowed to invite an officer into Admin B's department");
    }
    console.log("   -> StaffAuthService.createInvitation rejected cross-admin department assignment with 403 Forbidden");

    // Admin A attempts to reassign an officer to Department B via PATCH /api/v1/users/:id/role
    const crossAssignRes = await request(app)
      .patch(`/api/v1/users/${officerA._id}/role`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`)
      .send({
        role: UserRole.OFFICER,
        departmentId: deptBId,
      });

    if (crossAssignRes.status !== 403) {
      throw new Error(`Expected 403 when Admin A assigns officer to Dept B, got ${crossAssignRes.status}`);
    }
    console.log("   -> PATCH /api/v1/users/:id/role rejected cross-admin department assignment with 403 Forbidden");

    // 2f. Officer Directory Scoping:
    // Admin A calls GET /api/v1/users?role=OFFICER -> sees Officer A, does NOT see Officer B
    const listOfficersARes = await request(app)
      .get("/api/v1/users?role=OFFICER")
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (listOfficersARes.status !== 200) {
      throw new Error(`Failed to list officers for Admin A: ${listOfficersARes.status}`);
    }
    const adminAOfficers = listOfficersARes.body.data.map((u: any) => u.email);
    if (!adminAOfficers.includes(officerA.email)) {
      throw new Error(`Admin A cannot see Officer A (${officerA.email}) in their department`);
    }
    if (adminAOfficers.includes(officerB.email)) {
      throw new Error(`LEAK: Admin A can see Officer B (${officerB.email}) assigned to Admin B's department!`);
    }
    console.log("   -> Admin A officer directory correctly scoped: includes Officer A, excludes Officer B");

    // Admin B calls GET /api/v1/users?role=OFFICER -> sees Officer B, does NOT see Officer A
    const listOfficersBRes = await request(app)
      .get("/api/v1/users?role=OFFICER")
      .set("Cookie", `civictrack_admin_token=${tokenB}`);

    const adminBOfficers = listOfficersBRes.body.data.map((u: any) => u.email);
    if (!adminBOfficers.includes(officerB.email)) {
      throw new Error(`Admin B cannot see Officer B (${officerB.email}) in their department`);
    }
    if (adminBOfficers.includes(officerA.email)) {
      throw new Error(`LEAK: Admin B can see Officer A (${officerA.email}) assigned to Admin A's department!`);
    }
    console.log("   -> Admin B officer directory correctly scoped: includes Officer B, excludes Officer A");

    // 2g. Officer Deletion Cross-Admin Protection:
    // Admin A attempts to delete Officer B -> must be rejected with 403 Forbidden
    const crossDeleteRes = await request(app)
      .delete(`/api/v1/users/officers/${officerB._id}`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (crossDeleteRes.status !== 403) {
      throw new Error(`Expected 403 when Admin A deletes Officer B, got ${crossDeleteRes.status}`);
    }
    console.log("   -> DELETE /api/v1/users/officers/:id rejected cross-admin officer deletion with 403 Forbidden");

    // Admin A deletes Officer A (authorized) -> 200 OK
    const authDeleteRes = await request(app)
      .delete(`/api/v1/users/officers/${officerA._id}`)
      .set("Cookie", `civictrack_admin_token=${tokenA}`);

    if (authDeleteRes.status !== 200) {
      throw new Error(`Expected 200 when Admin A deletes Officer A, got ${authDeleteRes.status}`);
    }
    const checkDeleted = await UserModel.findById(officerA._id);
    if (checkDeleted) {
      throw new Error("Officer A was not removed after successful deletion");
    }
    console.log("   -> Admin A successfully deleted Officer A belonging to their department");

    // 2h. Newly registered admin ownership isolation:
    // Create new Admin C without any departments
    const { admin: adminC, token: tokenC } = await createAdminWithToken(
      "Administrator Gamma",
      `admin.gamma.${testSuffix}@civictrack.gov`
    );

    const listDeptCRes = await request(app)
      .get("/api/v1/departments")
      .set("Cookie", `civictrack_admin_token=${tokenC}`);

    if (listDeptCRes.status !== 200 || listDeptCRes.body.data.length !== 0) {
      throw new Error(`Expected 0 departments for newly registered Admin C, got ${listDeptCRes.body.data.length}`);
    }
    console.log("   -> New Admin C sees 0 departments (no unowned/other admin leaks)");

    const listOfficersCRes = await request(app)
      .get("/api/v1/users?role=OFFICER")
      .set("Cookie", `civictrack_admin_token=${tokenC}`);

    if (listOfficersCRes.status !== 200 || listOfficersCRes.body.data.length !== 0) {
      throw new Error(`Expected 0 officers for newly registered Admin C, got ${listOfficersCRes.body.data.length}`);
    }
    console.log("   -> New Admin C sees 0 officers");

    // 2i. Legacy departments with no createdByAdminId are NOT visible to Admin C
    const legacyDept = await DepartmentModel.create({
      name: `Legacy Department ${testSuffix}`,
      code: `LEG${testSuffix.slice(-4)}`,
      categories: [ComplaintCategory.GENERAL],
      isActive: true,
      // createdByAdminId is intentionally undefined / omitted
    });

    const listDeptCWithLegacy = await request(app)
      .get("/api/v1/departments")
      .set("Cookie", `civictrack_admin_token=${tokenC}`);

    const legacyVisible = listDeptCWithLegacy.body.data.some((d: any) => d._id === legacyDept._id.toString());
    if (legacyVisible) {
      throw new Error("LEAK: Legacy department without createdByAdminId is visible to Admin C!");
    }
    console.log("   -> Legacy department without createdByAdminId correctly excluded from Admin C's view");

    // Clean up test documents
    await DepartmentModel.deleteMany({
      _id: { $in: [deptAId, deptBId, legacyDept._id] },
    });
    await UserModel.deleteMany({
      _id: { $in: [adminA._id, adminB._id, adminC._id, officerA._id, officerB._id] },
    });
    await StaffSessionModel.deleteMany({
      userId: { $in: [adminA._id, adminB._id, adminC._id] },
    });

    console.log("\nAll Admin Scoped Data Access Tests PASSED Successfully!\n");
  } finally {
    await disconnectDatabase();
  }
}

runAdminScopedDataTests().catch((err) => {
  console.error("FATAL: Admin Scoped Data Test failure:\n", err);
  process.exit(1);
});
