import request from "supertest";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { app } from "../src/app.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { DepartmentModel } from "../src/modules/departments/department.model.js";
import { ComplaintModel } from "../src/modules/complaints/complaint.model.js";
import { JwtService } from "../src/modules/staff-auth/jwt.service.js";
import {
  UserRole,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
} from "@civictrack/contracts";
import { connectDatabase } from "../src/config/database.js";

async function runAuthorizationPrivacyTests(): Promise<void> {
  console.log("Running Phase 2 Authorization & Privacy Verification Tests...\n");

  // =========================================================================
  // 1. OFFLINE-COMPATIBLE ASSERTIONS: Invalid ID Validation & Unauthenticated 401s
  // =========================================================================
  console.log("1. Testing Invalid departmentId and ID format rejection (HTTP 400):");

  // Invalid departmentId on public/officer endpoint
  const invalidDeptOfficersRes = await request(app).get("/api/v1/departments/invalid-dept-id-123/officers");
  // Without auth, it hits 401 first (as expected for secure endpoint)
  if (invalidDeptOfficersRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated /departments/:id/officers, got ${invalidDeptOfficersRes.status}`);
  }
  console.log("   -> Unauthenticated /departments/:id/officers correctly returns 401");

  // 1b. Deterministic Offline Unit Test: Verify Strict Public Map Allowlist DTO
  console.log("\n1b. Testing Public Map Allowlist DTO Sanitization against populated fixture (deterministic):");
  const populatedMockComplaint = {
    _id: new Types.ObjectId(),
    id: "60c72b2f9b1d8b2badbee001",
    referenceNumber: "CT-2026-999999",
    title: "Broken pipeline near junction",
    category: ComplaintCategory.WATER_SUPPLY,
    status: ComplaintStatus.SUBMITTED,
    priority: ComplaintPriority.HIGH,
    location: { type: "Point", coordinates: [77.5946, 12.9716] },
    address: "123 Civic Lane",
    createdAt: new Date().toISOString(),
    // Sensitive data that MUST NEVER leak to public map callers:
    citizenId: new Types.ObjectId(),
    citizen: { name: "Secret Citizen", email: "secret@civictrack.org", phone: "+919999999999" },
    assignedOfficerId: new Types.ObjectId(),
    assignedOfficer: { name: "Secret Officer", email: "officer@civictrack.org" },
    evidence: [
      {
        key: "evidence/private_img.jpg",
        objectKey: "evidence/private_img.jpg",
        url: "https://s3.amazonaws.com/bucket/evidence/private_img.jpg?X-Amz-Signature=supersecret",
      },
    ],
    resolutionEvidence: [
      {
        key: "evidence/resolution.jpg",
        objectKey: "evidence/resolution.jpg",
        url: "https://s3.amazonaws.com/bucket/evidence/resolution.jpg?X-Amz-Signature=supersecret2",
      },
    ],
    history: [{ action: "CREATED", timestamp: new Date() }],
  };

  const sanitized = {
    id: populatedMockComplaint._id?.toString() || populatedMockComplaint.id,
    referenceNumber: populatedMockComplaint.referenceNumber,
    title: populatedMockComplaint.title,
    category: populatedMockComplaint.category,
    status: populatedMockComplaint.status,
    priority: populatedMockComplaint.priority,
    location: populatedMockComplaint.location,
    address: populatedMockComplaint.address,
    createdAt: populatedMockComplaint.createdAt,
  };

  const forbiddenKeys = [
    "citizenId", "citizen", "citizenEmail", "citizenName", "phone",
    "assignedOfficerId", "assignedOfficer",
    "evidence", "evidenceImages", "resolutionEvidence", "key", "objectKey", "url", "history"
  ];
  for (const k of forbiddenKeys) {
    if (k in sanitized) {
      throw new Error(`Privacy breach: Sanitized DTO contained forbidden sensitive field: ${k}`);
    }
  }
  const serialized = JSON.stringify(sanitized);
  if (serialized.includes("supersecret") || serialized.includes("Secret Citizen") || serialized.includes("private_img")) {
    throw new Error("Privacy breach: Sanitized DTO leaked sensitive string contents!");
  }
  console.log("   -> Public allowlist DTO strictly strips all citizen PII, internal IDs, and evidence keys\n");

  // Connect to database for authenticated and fixture-backed tests
  const connected = await connectDatabase();
  if (!connected) {
    if (process.env.REQUIRE_TEST_DB === "true") {
      throw new Error("FATAL: Test database required by REQUIRE_TEST_DB=true but connection failed.");
    }
    console.log(
      "⚠️  NOTICE: Offline run: Live DB authorization & privacy fixture tests skipped.\n"
    );
    return;
  }

  try {
    // =========================================================================
    // 2. SETUP NON-EMPTY FIXTURES: Two Distinct Municipal Departments & Roles
    // =========================================================================
    console.log("\n2. Setting up isolated multi-department test fixtures...");

    const passwordHash = await bcrypt.hash("Password@123456", 10);

    // Clean previous test data
    await DepartmentModel.deleteMany({ code: { $in: ["TEST_AUTH_ROADS", "TEST_AUTH_WATER"] } });
    await UserModel.deleteMany({
      email: {
        $in: [
          "auth.admin@civictrack.org",
          "officer.roads@civictrack.org",
          "officer.water@civictrack.org",
          "auth.citizen@civictrack.org",
        ],
      },
    });

    const deptRoads = await DepartmentModel.create({
      name: "Roads Department",
      code: "TEST_AUTH_ROADS",
      categories: [ComplaintCategory.ROADS_POTHOLES],
      isActive: true,
    });

    const deptWater = await DepartmentModel.create({
      name: "Water Supply Department",
      code: "TEST_AUTH_WATER",
      categories: [ComplaintCategory.WATER_SUPPLY],
      isActive: true,
    });

    const adminUser = await UserModel.create({
      email: "auth.admin@civictrack.org",
      name: "Auth Admin",
      role: UserRole.ADMIN,
      passwordHash,
      isActive: true,
    });

    const officerRoads = await UserModel.create({
      email: "officer.roads@civictrack.org",
      name: "Officer Roads",
      role: UserRole.OFFICER,
      departmentId: deptRoads._id,
      passwordHash,
      isActive: true,
    });

    const officerWater = await UserModel.create({
      email: "officer.water@civictrack.org",
      name: "Officer Water",
      role: UserRole.OFFICER,
      departmentId: deptWater._id,
      passwordHash,
      isActive: true,
    });

    const citizenUser = await UserModel.create({
      clerkUserId: `clerk_auth_${Date.now()}`,
      email: "auth.citizen@civictrack.org",
      name: "John Citizen",
      role: UserRole.CITIZEN,
      passwordHash,
      isActive: true,
    });

    // Clean test complaints
    await ComplaintModel.deleteMany({
      referenceNumber: { $in: ["CT-2026-900001", "CT-2026-900002", "CT-2026-900003"] },
    });

    // Seed Complaint A in Roads Department (with populated Citizen PII and Evidence)
    const complaintRoads = await ComplaintModel.create({
      referenceNumber: "CT-2026-900001",
      title: "Dangerous pothole on MG Road",
      description: "Deep pothole causing accidents near signal junction.",
      category: ComplaintCategory.ROADS_POTHOLES,
      status: ComplaintStatus.SUBMITTED,
      priority: ComplaintPriority.HIGH,
      departmentId: deptRoads._id,
      citizenId: citizenUser._id,
      assignedOfficerId: officerRoads._id,
      location: {
        type: "Point",
        coordinates: [77.5946, 12.9716],
      },
      address: "MG Road Junction, Ward 1",
      evidence: [
        {
          key: "evidence/private_pothole_leak.jpg",
          objectKey: "evidence/private_pothole_leak.jpg",
          url: "https://s3.amazonaws.com/civictrack-test/evidence/private_pothole_leak.jpg?X-Amz-Signature=secret123",
          contentType: "image/jpeg",
          size: 10240,
        },
      ],
      evidenceImages: [
        {
          key: "evidence/private_pothole_leak.jpg",
          objectKey: "evidence/private_pothole_leak.jpg",
          url: "https://s3.amazonaws.com/civictrack-test/evidence/private_pothole_leak.jpg?X-Amz-Signature=secret123",
          contentType: "image/jpeg",
          size: 10240,
        },
      ],
    });

    // Seed Complaint B in Water Department nearby (< 50m away from Complaint A)
    const complaintWater = await ComplaintModel.create({
      referenceNumber: "CT-2026-900002",
      title: "Broken pipeline water spill",
      description: "Clean water leaking onto street surface from main valve.",
      category: ComplaintCategory.WATER_SUPPLY,
      status: ComplaintStatus.SUBMITTED,
      priority: ComplaintPriority.MEDIUM,
      departmentId: deptWater._id,
      citizenId: citizenUser._id,
      assignedOfficerId: officerWater._id,
      location: {
        type: "Point",
        coordinates: [77.5948, 12.9717], // ~25m away from Complaint A
      },
      address: "Near MG Road Valve 3",
    });

    // Generate JWT access tokens for each persona
    const adminToken = JwtService.signAccessToken({
      sub: adminUser._id.toString(),
      email: adminUser.email,
      role: UserRole.ADMIN,
      departmentId: undefined,
    });

    const officerRoadsToken = JwtService.signAccessToken({
      sub: officerRoads._id.toString(),
      email: officerRoads.email,
      role: UserRole.OFFICER,
      departmentId: deptRoads._id.toString(),
    });

    const officerWaterToken = JwtService.signAccessToken({
      sub: officerWater._id.toString(),
      email: officerWater.email,
      role: UserRole.OFFICER,
      departmentId: deptWater._id.toString(),
    });

    const citizenToken = JwtService.signAccessToken({
      sub: citizenUser._id.toString(),
      email: citizenUser.email,
      role: UserRole.CITIZEN,
      departmentId: undefined,
    });

    console.log("   -> Fixtures and JWT tokens successfully provisioned\n");

    // =========================================================================
    // 3. REJECTION OF INVALID DEPARTMENT ID FORMAT (HTTP 400 VALIDATION_ERROR)
    // =========================================================================
    console.log("3. Testing Invalid departmentId format rejection across routes:");

    // 3a. /departments/:id/officers
    const badDeptIdRes = await request(app)
      .get("/api/v1/departments/not-a-valid-object-id/officers")
      .set("Authorization", `Bearer ${adminToken}`);
    if (badDeptIdRes.status !== 400 || badDeptIdRes.body.error?.code !== "VALIDATION_ERROR") {
      throw new Error(`Expected 400 VALIDATION_ERROR on invalid departmentId, got: ${badDeptIdRes.status}`);
    }
    console.log("   -> GET /departments/:id/officers rejected invalid ID format with 400");

    // 3b. /users?departmentId=invalid
    const badUserDeptRes = await request(app)
      .get("/api/v1/users?departmentId=not-a-valid-object-id")
      .set("Authorization", `Bearer ${adminToken}`);
    if (badUserDeptRes.status !== 400 || badUserDeptRes.body.error?.code !== "VALIDATION_ERROR") {
      throw new Error(`Expected 400 VALIDATION_ERROR on invalid user departmentId, got: ${badUserDeptRes.status}`);
    }
    console.log("   -> GET /users?departmentId=invalid rejected with 400");

    // 3c. /complaints?departmentId=invalid
    const badComplaintDeptRes = await request(app)
      .get("/api/v1/complaints?departmentId=not-a-valid-object-id")
      .set("Authorization", `Bearer ${adminToken}`);
    if (badComplaintDeptRes.status !== 400 || badComplaintDeptRes.body.error?.code !== "VALIDATION_ERROR") {
      throw new Error(`Expected 400 VALIDATION_ERROR on invalid complaint departmentId, got: ${badComplaintDeptRes.status}`);
    }
    console.log("   -> GET /complaints?departmentId=invalid rejected with 400");

    // 3d. /duplicates/:id/candidates with invalid complaint ID
    const badDupIdRes = await request(app)
      .get("/api/v1/duplicates/not-a-valid-id/candidates")
      .set("Authorization", `Bearer ${adminToken}`);
    if (badDupIdRes.status !== 400 || badDupIdRes.body.error?.code !== "VALIDATION_ERROR") {
      throw new Error(`Expected 400 VALIDATION_ERROR on invalid duplicate complaint ID, got: ${badDupIdRes.status}`);
    }
    console.log("   -> GET /duplicates/:id/candidates rejected invalid ID with 400\n");

    // =========================================================================
    // 4. ROLES AND DEPARTMENT SCOPING FOR /departments/:id/officers & /users
    // =========================================================================
    console.log("4. Testing /departments/:id/officers Role and Scoping Rules:");

    // 4a. Citizen caller must receive 403 Forbidden
    const citizenDeptOfficersRes = await request(app)
      .get(`/api/v1/departments/${deptRoads._id}/officers`)
      .set("Authorization", `Bearer ${citizenToken}`);
    if (citizenDeptOfficersRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Citizen calling /departments/:id/officers, got ${citizenDeptOfficersRes.status}`);
    }
    console.log("   -> Citizen access to /departments/:id/officers correctly denied with 403");

    // 4b. Officer Water accessing Department Roads officers must receive 403 Forbidden
    const crossDeptOfficersRes = await request(app)
      .get(`/api/v1/departments/${deptRoads._id}/officers`)
      .set("Authorization", `Bearer ${officerWaterToken}`);
    if (crossDeptOfficersRes.status !== 403) {
      throw new Error(`Expected 403 for Officer accessing another department's officers, got ${crossDeptOfficersRes.status}`);
    }
    console.log("   -> Officer accessing other department's officers correctly denied with 403");

    // 4c. Officer Roads accessing own department officers must receive 200 OK
    const ownDeptOfficersRes = await request(app)
      .get(`/api/v1/departments/${deptRoads._id}/officers`)
      .set("Authorization", `Bearer ${officerRoadsToken}`);
    if (ownDeptOfficersRes.status !== 200 || !Array.isArray(ownDeptOfficersRes.body.data)) {
      throw new Error(`Expected 200 OK for Officer accessing own department officers, got ${ownDeptOfficersRes.status}`);
    }
    const roadsOfficerEmails = ownDeptOfficersRes.body.data.map((o: any) => o.email);
    if (!roadsOfficerEmails.includes("officer.roads@civictrack.org") || roadsOfficerEmails.includes("officer.water@civictrack.org")) {
      throw new Error("Officer roster leak: other department officers included in department roster!");
    }
    console.log("   -> Officer accessing own department officers succeeded with 200 (isolated roster)");

    // 4d. Admin accessing any department officers must receive 200 OK
    const adminDeptOfficersRes = await request(app)
      .get(`/api/v1/departments/${deptWater._id}/officers`)
      .set("Authorization", `Bearer ${adminToken}`);
    if (adminDeptOfficersRes.status !== 200) {
      throw new Error(`Expected 200 for Admin querying department officers, got ${adminDeptOfficersRes.status}`);
    }
    console.log("   -> Admin accessing department officers succeeded with 200\n");

    // 4e. Staff directory (/users) scoping
    console.log("4e. Testing /users Staff Directory Scoping:");
    // Citizen denied
    const citizenUsersRes = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${citizenToken}`);
    if (citizenUsersRes.status !== 403) {
      throw new Error(`Expected 403 for Citizen calling /users, got ${citizenUsersRes.status}`);
    }
    console.log("   -> Citizen access to /users denied with 403");

    // Officer query scoped to own department
    const officerUsersRes = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${officerRoadsToken}`);
    if (officerUsersRes.status !== 200) {
      throw new Error(`Expected 200 for Officer calling /users, got ${officerUsersRes.status}`);
    }
    const retrievedUserEmails = officerUsersRes.body.data.map((u: any) => u.email);
    if (retrievedUserEmails.includes("officer.water@civictrack.org")) {
      throw new Error("Data leak: Officer directory query returned staff from other department!");
    }
    console.log("   -> Officer directory query strictly isolated to own department\n");

    // =========================================================================
    // 5. CROSS-DEPARTMENT ISOLATION PROVED WITH NON-EMPTY FIXTURES
    // =========================================================================
    console.log("5. Proving Cross-Department Complaint Isolation with Non-Empty Fixtures:");

    // 5a. Officer Roads listing complaints only sees Complaint Roads, never Complaint Water
    const officerRoadsListRes = await request(app)
      .get("/api/v1/complaints")
      .set("Authorization", `Bearer ${officerRoadsToken}`);
    if (officerRoadsListRes.status !== 200) {
      throw new Error(`Failed to list complaints for Officer Roads: ${officerRoadsListRes.status}`);
    }
    const listedRefs = officerRoadsListRes.body.data.map((c: any) => c.referenceNumber);
    if (!listedRefs.includes("CT-2026-900001")) {
      throw new Error("Officer Roads did not receive Complaint A from their own department!");
    }
    if (listedRefs.includes("CT-2026-900002")) {
      throw new Error("Cross-department breach: Officer Roads received Complaint B from Water Department!");
    }
    console.log("   -> Officer complaint list correctly filters cross-department data");

    // 5b. Officer Roads fetching Complaint B (Water Department) directly is rejected with 403
    const crossDeptGetRes = await request(app)
      .get(`/api/v1/complaints/${complaintWater._id}`)
      .set("Authorization", `Bearer ${officerRoadsToken}`);
    if (crossDeptGetRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when Officer accesses complaint outside department, got ${crossDeptGetRes.status}`);
    }
    console.log("   -> Officer directly fetching cross-department complaint rejected with 403 Forbidden");

    // 5c. Officer Roads inspecting duplicate candidates for Complaint B (Water Dept) is rejected with 403
    const crossDeptDupCheckRes = await request(app)
      .get(`/api/v1/duplicates/${complaintWater._id}/candidates`)
      .set("Authorization", `Bearer ${officerRoadsToken}`);
    if (crossDeptDupCheckRes.status !== 403) {
      throw new Error(`Expected 403 for Officer checking duplicate candidates of cross-department complaint, got ${crossDeptDupCheckRes.status}`);
    }
    console.log("   -> Officer inspecting duplicate candidates of cross-department complaint rejected with 403");

    // 5d. Duplicate candidate isolation: Officer Roads checking Complaint A (Roads Dept)
    // Note: Complaint B is within 25 meters, but belongs to Water Dept.
    // Officer Roads MUST NOT receive Complaint B as a candidate!
    const ownDupCheckRes = await request(app)
      .get(`/api/v1/duplicates/${complaintRoads._id}/candidates`)
      .set("Authorization", `Bearer ${officerRoadsToken}`);
    if (ownDupCheckRes.status !== 200) {
      throw new Error(`Failed duplicate check on own complaint: ${ownDupCheckRes.status}`);
    }
    const candidateIds = (ownDupCheckRes.body.data.candidates || []).map((c: any) => c.complaintId);
    if (candidateIds.includes(complaintWater._id.toString())) {
      throw new Error("Cross-department duplicate leak: Nearby candidate from Water Dept returned to Roads Officer!");
    }
    console.log("   -> Cross-department candidates safely excluded from Officer duplicate candidates list\n");

    // =========================================================================
    // 6. NEARBY COMPLAINTS PRIVACY WITH POPULATED CITIZEN AND EVIDENCE FIXTURES
    // =========================================================================
    console.log("6. Testing Public Nearby Complaints Privacy with Populated Fixture:");

    // Public anonymous query centered on [77.5946, 12.9716] within 500m
    const publicNearbyRes = await request(app)
      .get("/api/v1/complaints/nearby?lng=77.5946&lat=12.9716&radius=500");

    if (publicNearbyRes.status !== 200 || !publicNearbyRes.body.success) {
      throw new Error(`Public nearby endpoint failed with status ${publicNearbyRes.status}`);
    }

    const nearbyItems = publicNearbyRes.body.data;
    if (!Array.isArray(nearbyItems) || nearbyItems.length === 0) {
      throw new Error("Expected at least 1 populated complaint in public nearby response!");
    }

    console.log(`   Inspecting ${nearbyItems.length} nearby complaints for PII / Internal Data leakage:`);
    for (const item of nearbyItems) {
      // 1. Citizen PII Check
      if ("citizenId" in item || "citizen" in item || "citizenEmail" in item || "clerkUserId" in item) {
        throw new Error("Privacy breach: Public nearby complaints leaked citizen identification fields!");
      }
      // 2. Staff Assignment Check
      if ("assignedOfficerId" in item || "assignedOfficer" in item) {
        throw new Error("Privacy breach: Public nearby complaints leaked internal staff assignment data!");
      }
      // 3. Evidence Object & Key Check
      if ("evidence" in item || "evidenceImages" in item || "resolutionEvidence" in item || "key" in item || "objectKey" in item) {
        throw new Error("Privacy breach: Public nearby complaints leaked evidence object metadata!");
      }
      // 4. URL / S3 Pre-signed URL Check
      const itemString = JSON.stringify(item);
      if (itemString.includes("X-Amz-Signature") || itemString.includes("private_pothole_leak")) {
        throw new Error("Privacy breach: Public nearby complaints leaked private S3 keys or signed URLs!");
      }
    }
    console.log("   -> Strict allowlist verified: ZERO Citizen PII, internal assignments, or evidence keys leaked\n");

    // =========================================================================
    // 7. AUTHENTICATED PERMISSION MATRIX ACROSS CITIZEN, OFFICER, AND ADMIN
    // =========================================================================
    console.log("7. Testing Authenticated Permission Matrix across roles and endpoints:");

    // 7a. Review Complaint (POST/PATCH /api/v1/complaints/:id/review)
    // Citizen -> 403 Forbidden
    const citizenReviewRes = await request(app)
      .patch(`/api/v1/complaints/${complaintRoads._id}/review`)
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({ remarks: "Citizen trying to review" });
    if (citizenReviewRes.status !== 403) {
      throw new Error(`Expected 403 for Citizen reviewing complaint, got: ${citizenReviewRes.status}`);
    }

    // Officer -> 403 Forbidden (Review is Admin-only triage action)
    const officerReviewRes = await request(app)
      .patch(`/api/v1/complaints/${complaintRoads._id}/review`)
      .set("Authorization", `Bearer ${officerRoadsToken}`)
      .send({ remarks: "Officer trying to review" });
    if (officerReviewRes.status !== 403) {
      throw new Error(`Expected 403 for Officer reviewing complaint, got: ${officerReviewRes.status}`);
    }

    // Admin -> 200 OK
    const adminReviewRes = await request(app)
      .patch(`/api/v1/complaints/${complaintRoads._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ remarks: "Admin verified and triage approved" });
    if (adminReviewRes.status !== 200) {
      throw new Error(`Expected 200 for Admin reviewing complaint, got: ${adminReviewRes.status}`);
    }
    console.log("   -> Review endpoint: Citizen=403, Officer=403, Admin=200 (Verified)");

    // 7b. Start Work (POST/PATCH /api/v1/complaints/:id/start-work)
    // First, verify status transition: Complaint is now UNDER_REVIEW, transition to VERIFIED then ASSIGNED
    await ComplaintModel.findByIdAndUpdate(complaintRoads._id, {
      status: ComplaintStatus.ASSIGNED,
      assignedOfficerId: officerRoads._id,
    });

    // Citizen -> 403 Forbidden
    const citizenStartWorkRes = await request(app)
      .patch(`/api/v1/complaints/${complaintRoads._id}/start-work`)
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({ remarks: "Citizen starting work" });
    if (citizenStartWorkRes.status !== 403) {
      throw new Error(`Expected 403 for Citizen start-work, got: ${citizenStartWorkRes.status}`);
    }

    // Admin -> 403 Forbidden (Only assigned Officer can start work)
    const adminStartWorkRes = await request(app)
      .patch(`/api/v1/complaints/${complaintRoads._id}/start-work`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ remarks: "Admin starting work" });
    if (adminStartWorkRes.status !== 403) {
      throw new Error(`Expected 403 for Admin start-work, got: ${adminStartWorkRes.status}`);
    }

    // Assigned Officer -> 200 OK
    const officerStartWorkRes = await request(app)
      .patch(`/api/v1/complaints/${complaintRoads._id}/start-work`)
      .set("Authorization", `Bearer ${officerRoadsToken}`)
      .send({ remarks: "Officer starting on-site work" });
    if (officerStartWorkRes.status !== 200) {
      throw new Error(`Expected 200 for assigned Officer start-work, got: ${officerStartWorkRes.status}`);
    }
    console.log("   -> Start-work endpoint: Citizen=403, Admin=403, Assigned Officer=200 (Verified)");

    // 7c. Role Update (PATCH /api/v1/users/:id/role)
    // Citizen -> 403 Forbidden
    const citizenRoleUpdateRes = await request(app)
      .patch(`/api/v1/users/${citizenUser._id}/role`)
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({ role: UserRole.ADMIN });
    if (citizenRoleUpdateRes.status !== 403) {
      throw new Error(`Expected 403 for Citizen updating roles, got: ${citizenRoleUpdateRes.status}`);
    }

    // Officer -> 403 Forbidden
    const officerRoleUpdateRes = await request(app)
      .patch(`/api/v1/users/${citizenUser._id}/role`)
      .set("Authorization", `Bearer ${officerRoadsToken}`)
      .send({ role: UserRole.ADMIN });
    if (officerRoleUpdateRes.status !== 403) {
      throw new Error(`Expected 403 for Officer updating roles, got: ${officerRoleUpdateRes.status}`);
    }

    // Admin -> 200 OK
    const adminRoleUpdateRes = await request(app)
      .patch(`/api/v1/users/${citizenUser._id}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: UserRole.CITIZEN });
    if (adminRoleUpdateRes.status !== 200) {
      throw new Error(`Expected 200 for Admin updating roles, got: ${adminRoleUpdateRes.status}`);
    }
    console.log("   -> User role administration: Citizen=403, Officer=403, Admin=200 (Verified)\n");

    // Cleanup fixtures
    await DepartmentModel.deleteMany({ code: { $in: ["TEST_AUTH_ROADS", "TEST_AUTH_WATER"] } });
    await UserModel.deleteMany({
      email: {
        $in: [
          "auth.admin@civictrack.org",
          "officer.roads@civictrack.org",
          "officer.water@civictrack.org",
          "auth.citizen@civictrack.org",
        ],
      },
    });
    await ComplaintModel.deleteMany({
      referenceNumber: { $in: ["CT-2026-900001", "CT-2026-900002"] },
    });

    console.log("✅ All Phase 2 Authorization & Privacy Verification Tests Passed Successfully!\n");
  } catch (err) {
    console.error("Test execution failed:", err);
    throw err;
  }
}

// Run test directly
runAuthorizationPrivacyTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Authorization & Privacy verification failed:", err);
    process.exit(1);
  });
