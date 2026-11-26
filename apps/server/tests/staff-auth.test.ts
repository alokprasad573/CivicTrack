import request from "supertest";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { app } from "../src/app.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { StaffSessionModel } from "../src/modules/staff-auth/staff-session.model.js";
import { StaffInvitationModel } from "../src/modules/staff-auth/staff-invitation.model.js";
import { DepartmentModel } from "../src/modules/departments/department.model.js";
import {
  UserRole,
  ComplaintCategory,
  AdminRegisterSchema,
  CreateStaffInvitationSchema,
  AcceptStaffInvitationSchema,
} from "@civictrack/contracts";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";

async function runStaffAuthTests(): Promise<void> {
  console.log("Running Custom Staff JWT Authentication & RBAC Verification Tests...\n");

  console.log("0. Running Deterministic Invitation & Schema Security Tests:");

  // 0a. CreateStaffInvitationSchema validation
  const validOfficerInvite = CreateStaffInvitationSchema.safeParse({
    email: "officer@civictrack.org",
    role: UserRole.OFFICER,
    departmentId: "673f11112222333344445555",
  });
  if (!validOfficerInvite.success) {
    throw new Error("Failed: CreateStaffInvitationSchema rejected valid officer invitation");
  }

  const missingDeptOfficerInvite = CreateStaffInvitationSchema.safeParse({
    email: "officer@civictrack.org",
    role: UserRole.OFFICER,
  });
  if (missingDeptOfficerInvite.success) {
    throw new Error("Failed: CreateStaffInvitationSchema must reject officer invitation without departmentId");
  }

  const citizenInvite = CreateStaffInvitationSchema.safeParse({
    email: "citizen@civictrack.org",
    role: UserRole.CITIZEN,
  });
  if (citizenInvite.success) {
    throw new Error("Failed: CreateStaffInvitationSchema must reject citizen role");
  }

  const invalidEmailInvite = CreateStaffInvitationSchema.safeParse({
    email: "not-an-email",
    role: UserRole.ADMIN,
  });
  if (invalidEmailInvite.success) {
    throw new Error("Failed: CreateStaffInvitationSchema must reject invalid email");
  }
  console.log("   -> Staff invitation creation schema rules verified");

  // 0b. AcceptStaffInvitationSchema validation
  const weakPasswordAccept = AcceptStaffInvitationSchema.safeParse({
    token: "abcdef1234567890abcdef1234567890",
    name: "John Officer",
    password: "password", // weak: no upper, number, symbol
    confirmPassword: "password",
  });
  if (weakPasswordAccept.success) {
    throw new Error("Failed: AcceptStaffInvitationSchema must reject weak passwords lacking required character classes");
  }

  const mismatchPasswordAccept = AcceptStaffInvitationSchema.safeParse({
    token: "abcdef1234567890abcdef1234567890",
    name: "John Officer",
    password: "Password@123",
    confirmPassword: "Password@999",
  });
  if (mismatchPasswordAccept.success) {
    throw new Error("Failed: AcceptStaffInvitationSchema must reject mismatched passwords");
  }

  const shortTokenAccept = AcceptStaffInvitationSchema.safeParse({
    token: "short",
    name: "John Officer",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (shortTokenAccept.success) {
    throw new Error("Failed: AcceptStaffInvitationSchema must reject short tokens");
  }

  const validAccept = AcceptStaffInvitationSchema.safeParse({
    token: "abcdef1234567890abcdef1234567890",
    name: "John Officer",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (!validAccept.success) {
    throw new Error("Failed: AcceptStaffInvitationSchema rejected valid payload: " + JSON.stringify(validAccept.error));
  }
  console.log("   -> Staff invitation acceptance schema & strong password enforcement verified");

  // 0c. Cryptographic Token Hashing verification
  const rawTestToken = crypto.randomBytes(32).toString("hex");
  const tokenHashA = crypto.createHash("sha256").update(rawTestToken).digest("hex");
  const tokenHashB = crypto.createHash("sha256").update(rawTestToken).digest("hex");
  if (tokenHashA !== tokenHashB || tokenHashA.length !== 64 || tokenHashA === rawTestToken) {
    throw new Error("Failed: Cryptographic token hashing must be deterministic, 64-char hex, and distinct from rawToken");
  }
  console.log("   -> Cryptographic SHA-256 token hashing verified");

  // 0d. Unauthenticated endpoint access controls
  const unauthCreateRes = await request(app).post("/api/v1/admin/invitations").send({ email: "test@test.com", role: UserRole.OFFICER });
  if (unauthCreateRes.status !== 401) {
    throw new Error(`Failed: Unauthenticated POST /api/v1/admin/invitations must return 401, got ${unauthCreateRes.status}`);
  }

  const unauthListRes = await request(app).get("/api/v1/admin/invitations");
  if (unauthListRes.status !== 401) {
    throw new Error(`Failed: Unauthenticated GET /api/v1/admin/invitations must return 401, got ${unauthListRes.status}`);
  }

  const emptyAcceptRes = await request(app).post("/api/v1/staff/invitations/accept").send({});
  if (emptyAcceptRes.status !== 400) {
    throw new Error(`Failed: Empty POST /api/v1/staff/invitations/accept must return 400, got ${emptyAcceptRes.status}`);
  }

  const emptyVerifyRes = await request(app).get("/api/v1/staff/invitations/verify");
  if (emptyVerifyRes.status !== 400) {
    throw new Error(`Failed: Empty GET /api/v1/staff/invitations/verify must return 400, got ${emptyVerifyRes.status}`);
  }

  // 0e. AdminRegisterSchema validation & direct admin registration endpoint validation
  console.log("0e. Testing AdminRegisterSchema & Direct Registration Name Validation:");
  const validAdminReg = AdminRegisterSchema.safeParse({
    name: "Sarah Jenkins",
    email: "sarah.admin@civictrack.org",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (!validAdminReg.success) {
    throw new Error("Failed: AdminRegisterSchema rejected valid registration payload");
  }

  const emptyNameReg = AdminRegisterSchema.safeParse({
    name: "",
    email: "sarah.admin@civictrack.org",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (emptyNameReg.success) {
    throw new Error("Failed: AdminRegisterSchema must reject empty name");
  }

  const whitespaceNameReg = AdminRegisterSchema.safeParse({
    name: "    ",
    email: "sarah.admin@civictrack.org",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (whitespaceNameReg.success) {
    throw new Error("Failed: AdminRegisterSchema must reject whitespace-only name");
  }

  const longNameReg = AdminRegisterSchema.safeParse({
    name: "a".repeat(121),
    email: "sarah.admin@civictrack.org",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (longNameReg.success) {
    throw new Error("Failed: AdminRegisterSchema must reject name exceeding 120 characters");
  }

  // HTTP endpoint rejects missing name
  const missingNameRes = await request(app)
    .post("/api/v1/admin/auth/register")
    .send({
      email: "missing.name@civictrack.org",
      password: "Password@123",
      confirmPassword: "Password@123",
    });
  if (missingNameRes.status !== 400) {
    throw new Error(`Failed: POST /api/v1/admin/auth/register without name must return 400, got ${missingNameRes.status}`);
  }

  // HTTP endpoint rejects blank name
  const blankNameRes = await request(app)
    .post("/api/v1/admin/auth/register")
    .send({
      name: "   ",
      email: "blank.name@civictrack.org",
      password: "Password@123",
      confirmPassword: "Password@123",
    });
  if (blankNameRes.status !== 400) {
    throw new Error(`Failed: POST /api/v1/admin/auth/register with blank name must return 400, got ${blankNameRes.status}`);
  }

  // HTTP endpoint rejects name exceeding 120 characters
  const tooLongNameRes = await request(app)
    .post("/api/v1/admin/auth/register")
    .send({
      name: "a".repeat(121),
      email: "toolong.name@civictrack.org",
      password: "Password@123",
      confirmPassword: "Password@123",
    });
  if (tooLongNameRes.status !== 400) {
    throw new Error(`Failed: POST /api/v1/admin/auth/register with 121-char name must return 400, got ${tooLongNameRes.status}`);
  }
  console.log("   -> Direct admin registration name validation rules strictly enforced\n");
  console.log("   -> Unauthenticated / invalid payload protections verified\n");

  const connected = await connectDatabase();
  if (!connected) {
    if (process.env.REQUIRE_TEST_DB === "true") {
      throw new Error(
        "FATAL: Isolated integration test database is required by REQUIRE_TEST_DB=true but connection failed."
      );
    }
    console.log(
      "⚠️  NOTICE: Offline run: Live DB staff-auth integration tests skipped (Run 'npm run test:integration:db' with TEST_DATABASE_URL to execute integration suite).\n"
    );
    return;
  }

  try {
    // 1. Setup test department and users
    let testDept = await DepartmentModel.findOne({ code: "TEST_DEPT" });
    if (!testDept) {
      testDept = await DepartmentModel.create({
        name: "Test Municipal Department",
        code: "TEST_DEPT",
        categories: [ComplaintCategory.ROADS_POTHOLES],
        isActive: true,
      });
    }

    const testPassword = "Password@123456";
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Clean any prior test users
    await UserModel.deleteMany({ email: { $in: ["test.admin@civictrack.org", "test.officer@civictrack.org", "test.inactive@civictrack.org"] } });

    const adminUser = await UserModel.create({
      email: "test.admin@civictrack.org",
      name: "Test Admin",
      role: UserRole.ADMIN,
      passwordHash,
      isActive: true,
    });

    const officerUser = await UserModel.create({
      email: "test.officer@civictrack.org",
      name: "Test Officer",
      role: UserRole.OFFICER,
      departmentId: testDept._id,
      passwordHash,
      isActive: true,
    });

    const inactiveStaff = await UserModel.create({
      email: "test.inactive@civictrack.org",
      name: "Inactive Staff",
      role: UserRole.ADMIN,
      passwordHash,
      isActive: false,
    });

    // TEST 1: Admin login with valid credentials
    console.log("1. Testing Admin Login with valid credentials:");
    const adminLoginRes = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "test.admin@civictrack.org", password: testPassword });

    console.log("   Status:", adminLoginRes.status);
    if (adminLoginRes.status !== 200 || !adminLoginRes.body.data?.accessToken) {
      throw new Error("Failed: Admin login must return 200 with accessToken");
    }
    const adminCookies = adminLoginRes.headers["set-cookie"] as unknown as string[];
    const hasAdminTokenCookie = adminCookies?.some((c) => c.includes("civictrack_admin_token="));
    const hasAdminRefreshCookie = adminCookies?.some((c) => c.includes("civictrack_admin_refresh="));
    if (!hasAdminTokenCookie || !hasAdminRefreshCookie) {
      throw new Error("Failed: Admin login must set civictrack_admin_token and civictrack_admin_refresh cookies");
    }
    console.log("   -> Admin login verified, HttpOnly cookies issued successfully\n");

    let adminToken = adminLoginRes.body.data.accessToken;

    // TEST 2: Officer login with valid credentials
    console.log("2. Testing Officer Login with valid credentials:");
    const officerLoginRes = await request(app)
      .post("/api/v1/officer/auth/login")
      .send({ email: "test.officer@civictrack.org", password: testPassword });

    console.log("   Status:", officerLoginRes.status);
    if (officerLoginRes.status !== 200 || !officerLoginRes.body.data?.accessToken) {
      throw new Error("Failed: Officer login must return 200 with accessToken");
    }
    const officerCookies = officerLoginRes.headers["set-cookie"] as unknown as string[];
    const hasOfficerTokenCookie = officerCookies?.some((c) => c.includes("civictrack_officer_token="));
    const hasOfficerRefreshCookie = officerCookies?.some((c) => c.includes("civictrack_officer_refresh="));
    if (!hasOfficerTokenCookie || !hasOfficerRefreshCookie) {
      throw new Error("Failed: Officer login must set civictrack_officer_token and civictrack_officer_refresh cookies");
    }
    console.log("   -> Officer login verified, HttpOnly cookies issued successfully\n");

    const officerToken = officerLoginRes.body.data.accessToken;

    // TEST 3: Invalid password rejection
    console.log("3. Testing Login with invalid password:");
    const badPasswordRes = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "test.admin@civictrack.org", password: "WrongPassword999!" });

    console.log("   Status:", badPasswordRes.status);
    if (badPasswordRes.status !== 401) {
      throw new Error("Failed: Invalid password must return 401 UNAUTHORIZED");
    }
    console.log("   -> Correctly rejected with 401 generic error\n");

    // TEST 4: Cross-portal role rejection (Officer trying to login at /admin/auth/login)
    console.log("4. Testing Cross-Role Login rejection (Officer at Admin portal):");
    const crossRoleLoginRes = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "test.officer@civictrack.org", password: testPassword });

    console.log("   Status:", crossRoleLoginRes.status);
    if (crossRoleLoginRes.status !== 401) {
      throw new Error("Failed: Officer credentials at Admin portal must be rejected with 401");
    }
    console.log("   -> Cross-role login rejected with 401 generic error\n");

    // TEST 5: Inactive staff account rejection
    console.log("5. Testing Inactive Staff Login rejection:");
    const inactiveLoginRes = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "test.inactive@civictrack.org", password: testPassword });

    console.log("   Status:", inactiveLoginRes.status);
    if (inactiveLoginRes.status !== 403) {
      throw new Error("Failed: Inactive staff account must be rejected with 403 FORBIDDEN");
    }
    console.log("   -> Inactive account rejected with 403 FORBIDDEN\n");

    // TEST 6: Refresh token rotation
    console.log("6. Testing Refresh Token Rotation:");
    // Extract refresh cookie from admin login
    const refreshCookieStr = adminCookies.find((c) => c.startsWith("civictrack_admin_refresh="))!;
    const refreshVal = refreshCookieStr.split(";")[0].replace("civictrack_admin_refresh=", "");

    const refreshRes = await request(app)
      .post("/api/v1/admin/auth/refresh")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", [`civictrack_admin_refresh=${refreshVal}`])
      .send();

    console.log("   Status:", refreshRes.status);
    if (refreshRes.status !== 200 || !refreshRes.body.data?.accessToken) {
      throw new Error("Failed: Refresh must return 200 with rotated accessToken");
    }
    adminToken = refreshRes.body.data.accessToken;
    console.log("   -> Refresh token rotated successfully\n");

    // TEST 7: Replay of used refresh token must be rejected
    console.log("7. Testing Replay attack rejection (reusing old refresh token):");
    const replayRes = await request(app)
      .post("/api/v1/admin/auth/refresh")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", [`civictrack_admin_refresh=${refreshVal}`])
      .send();

    console.log("   Status:", replayRes.status);
    if (replayRes.status !== 401) {
      throw new Error("Failed: Replaying already-used refresh token must be rejected with 401");
    }
    console.log("   -> Refresh token reuse correctly blocked with 401\n");

    // TEST 8: Verified GET /api/v1/admin/auth/me with Admin Cookie
    console.log("8. Testing GET /api/v1/admin/auth/me with Admin Session Cookie:");
    const meRes = await request(app)
      .get("/api/v1/admin/auth/me")
      .set("Cookie", [`civictrack_admin_token=${adminToken}`]);

    console.log("   Status:", meRes.status); console.log("   Body:", JSON.stringify(meRes.body));
    if (meRes.status !== 200 || meRes.body.data?.email !== "test.admin@civictrack.org") {
      throw new Error("Failed: /admin/auth/me must return 200 with verified admin profile");
    }
    console.log("   -> Verified Admin identity resolved from Cookie\n");

    // TEST 9: Cross-role protection (Admin Token on Officer-only route)
    console.log("9. Testing Cross-Role Route Protection (Admin token on Officer endpoint):");
    const crossRoleRes = await request(app)
      .get("/api/v1/officer/auth/me")
      .set("Cookie", [`civictrack_officer_token=${adminToken}`]);

    console.log("   Status:", crossRoleRes.status);
    if (crossRoleRes.status !== 403) {
      throw new Error("Failed: Admin token accessing Officer endpoint must be rejected with 403 FORBIDDEN");
    }
    console.log("   -> Cross-role access blocked with 403 FORBIDDEN\n");

    // TEST 10: Logout revokes session
    console.log("10. Testing Staff Logout:");
    const logoutRes = await request(app)
      .post("/api/v1/admin/auth/logout")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", [`civictrack_admin_refresh=${refreshVal}`]);

    console.log("   Status:", logoutRes.status);
    if (logoutRes.status !== 200) {
      throw new Error("Failed: Logout must return 200 OK");
    }
    const logoutCookies = logoutRes.headers["set-cookie"] as unknown as string[];
    const cleared = logoutCookies?.some((c) => c.includes("civictrack_admin_token=;"));
    if (!cleared) {
      throw new Error("Failed: Logout must clear civictrack_admin_token cookie");
    }
    console.log("   -> Logout revoked session and cleared cookies\n");

    // ==========================================
    // INVITATION & SECURE ONBOARDING TESTS (11-18)
    // ==========================================

    // TEST 11: Admin creates officer invitation
    console.log("11. Testing Admin Officer Invitation Creation:");
    const createInviteRes = await request(app)
      .post("/api/v1/admin/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "new.officer@civictrack.org",
        role: UserRole.OFFICER,
        departmentId: testDept._id.toString(),
      });

    console.log("   Status:", createInviteRes.status);
    if (createInviteRes.status !== 201 || !createInviteRes.body.data?.token) {
      throw new Error(`Failed: Admin invitation creation must return 201 with token, got ${createInviteRes.status}`);
    }
    const rawInviteToken = createInviteRes.body.data.token;
    const inviteId = createInviteRes.body.data.id;

    // Verify token is hashed in DB and raw token is NEVER stored in database
    const storedInvite = await StaffInvitationModel.findById(inviteId);
    if (!storedInvite || storedInvite.tokenHash === rawInviteToken || storedInvite.tokenHash.length !== 64) {
      throw new Error("Failed: Invitation token must be hashed in database with SHA-256 and raw token must not be persisted");
    }
    console.log("   -> Officer invitation created, cryptographically hashed token verified in database\n");

    // TEST 12: Non-admin cannot create invitations
    console.log("12. Testing Officer Privilege Escalation Prevention on Invitations:");
    const officerInviteRes = await request(app)
      .post("/api/v1/admin/invitations")
      .set("Authorization", `Bearer ${officerLoginRes.body.data.accessToken}`)
      .send({
        email: "rogue.officer@civictrack.org",
        role: UserRole.ADMIN,
      });

    console.log("   Status:", officerInviteRes.status);
    if (officerInviteRes.status !== 403) {
      throw new Error("Failed: Officer must be forbidden from creating invitations (403)");
    }
    console.log("   -> Non-admin invitation creation strictly blocked with 403 FORBIDDEN\n");

    // TEST 13: Verify invitation token endpoint
    console.log("13. Testing Public Invitation Verification Endpoint:");
    const verifyRes = await request(app)
      .get(`/api/v1/staff/invitations/verify?token=${rawInviteToken}`);

    console.log("   Status:", verifyRes.status);
    if (
      verifyRes.status !== 200 ||
      verifyRes.body.data?.email !== "new.officer@civictrack.org" ||
      verifyRes.body.data?.role !== UserRole.OFFICER ||
      verifyRes.body.data?.department?.code !== "TEST_DEPT"
    ) {
      throw new Error("Failed: Invitation verification must return 200 with correct role and department preview");
    }
    console.log("   -> Invitation token verified, preview returned role and assigned department\n");

    // TEST 14: Accept invitation with client role override attempt (Privilege Escalation test)
    console.log("14. Testing Invitation Acceptance & Client Role Injection Protection:");
    const acceptRes = await request(app)
      .post("/api/v1/staff/invitations/accept")
      .send({
        token: rawInviteToken,
        name: "New Onboarded Officer",
        password: "StrongOfficer@123",
        confirmPassword: "StrongOfficer@123",
        role: UserRole.ADMIN, // Malicious role escalation payload
      });

    console.log("   Status:", acceptRes.status);
    if (acceptRes.status !== 201 || !acceptRes.body.data?.accessToken) {
      throw new Error(`Failed: Invitation acceptance must return 201 with session, got ${acceptRes.status}`);
    }

    // Verify role was derived strictly from invitation (OFFICER) and NOT client body (ADMIN)
    if (acceptRes.body.data.user.role !== UserRole.OFFICER) {
      throw new Error("SECURITY FAILURE: User role was taken from client body instead of server invitation!");
    }
    if (acceptRes.body.data.user.passwordHash || JSON.stringify(acceptRes.body).includes("StrongOfficer@123")) {
      throw new Error("SECURITY FAILURE: Plaintext password or passwordHash leaked in response body!");
    }
    console.log("   -> Account onboarded: Client role elevation safely ignored, password sanitized from response\n");

    // TEST 15: Onboarded officer can immediately log in
    console.log("15. Testing Login with Newly Created Officer Account:");
    const newOfficerLoginRes = await request(app)
      .post("/api/v1/officer/auth/login")
      .send({
        email: "new.officer@civictrack.org",
        password: "StrongOfficer@123",
      });

    console.log("   Status:", newOfficerLoginRes.status);
    if (newOfficerLoginRes.status !== 200 || !newOfficerLoginRes.body.data?.accessToken) {
      throw new Error("Failed: Newly onboarded officer could not log in with set password");
    }
    console.log("   -> Officer successfully authenticated with new credentials\n");

    // TEST 16: Reused token rejected
    console.log("16. Testing Reused Token Rejection (Single-use enforcement):");
    const reusedAcceptRes = await request(app)
      .post("/api/v1/staff/invitations/accept")
      .send({
        token: rawInviteToken,
        name: "Second Attempt",
        password: "StrongOfficer@123",
        confirmPassword: "StrongOfficer@123",
      });

    console.log("   Status:", reusedAcceptRes.status);
    if (reusedAcceptRes.status !== 409 && reusedAcceptRes.status !== 400) {
      throw new Error("Failed: Reused invitation token must be rejected with 409 Conflict or 400 Validation Error");
    }
    console.log("   -> Reused invitation token successfully rejected\n");

    // TEST 17: Concurrent acceptance race condition test (Atomic conditional update)
    console.log("17. Testing Concurrent Invitation Acceptance (Atomic Single-Winner):");
    const concurrentInviteRes = await request(app)
      .post("/api/v1/admin/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "concurrent.officer@civictrack.org",
        role: UserRole.OFFICER,
        departmentId: testDept._id.toString(),
      });
    const concurrentToken = concurrentInviteRes.body.data.token;

    const [raceA, raceB] = await Promise.all([
      request(app).post("/api/v1/staff/invitations/accept").send({
        token: concurrentToken,
        name: "Concurrent Officer 1",
        password: "StrongPassword@123",
        confirmPassword: "StrongPassword@123",
      }),
      request(app).post("/api/v1/staff/invitations/accept").send({
        token: concurrentToken,
        name: "Concurrent Officer 2",
        password: "StrongPassword@123",
        confirmPassword: "StrongPassword@123",
      }),
    ]);

    const statuses = [raceA.status, raceB.status].sort();
    if (statuses[0] !== 201 || (statuses[1] !== 409 && statuses[1] !== 400)) {
      throw new Error(`Failed: Concurrent acceptance must produce exactly one 201 and one 409/400. Got: ${statuses.join(", ")}`);
    }
    console.log("   -> Atomic single-use conditional update verified: 1 winner (201), 1 rejected (409/400)\n");

    // TEST 18: Admin revokes invitation & revoked invite rejected
    console.log("18. Testing Admin Invitation Revocation:");
    const revokeTargetInvite = await request(app)
      .post("/api/v1/admin/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "revoked.officer@civictrack.org",
        role: UserRole.OFFICER,
        departmentId: testDept._id.toString(),
      });
    const revokeToken = revokeTargetInvite.body.data.token;
    const revokeId = revokeTargetInvite.body.data.id;

    const revokeRes = await request(app)
      .post(`/api/v1/admin/invitations/${revokeId}/revoke`)
      .set("Authorization", `Bearer ${adminToken}`);

    console.log("   Status:", revokeRes.status);
    if (revokeRes.status !== 200) {
      throw new Error("Failed: Admin must be able to revoke invitation (200)");
    }

    const tryAcceptRevoked = await request(app)
      .post("/api/v1/staff/invitations/accept")
      .send({
        token: revokeToken,
        name: "Revoked Officer",
        password: "StrongPassword@123",
        confirmPassword: "StrongPassword@123",
      });

    if (tryAcceptRevoked.status === 201) {
      throw new Error("Failed: Accepting revoked invitation must NOT succeed with 201");
    }
    console.log("   -> Revocation verified and revoked token acceptance rejected\n");

    // TEST 19: Direct Administrator Registration stores real name in MongoDB
    console.log("19. Testing Direct Administrator Registration with Real Name:");
    const testAdminEmail = `elena.admin.${Date.now()}@civictrack.org`;
    const testAdminRealName = "Elena Rostova";

    const directRegRes = await request(app)
      .post("/api/v1/admin/auth/register")
      .send({
        name: testAdminRealName,
        email: testAdminEmail,
        password: "StrongAdmin@123",
        confirmPassword: "StrongAdmin@123",
      });

    if (directRegRes.status !== 201 || !directRegRes.body.data?.user) {
      throw new Error(`Failed: Admin direct registration must return 201, got ${directRegRes.status}`);
    }

    if (directRegRes.body.data.user.name !== testAdminRealName) {
      throw new Error(`Failed: Response user name must be '${testAdminRealName}', got '${directRegRes.body.data.user.name}'`);
    }

    const savedAdminInDb = await UserModel.findOne({ email: testAdminEmail });
    if (!savedAdminInDb || savedAdminInDb.name !== testAdminRealName) {
      throw new Error(`Failed: MongoDB User document must store '${testAdminRealName}', got '${savedAdminInDb?.name}'`);
    }
    console.log("   -> Real name successfully saved to MongoDB admin User document without default fallback\n");

    await UserModel.deleteOne({ _id: savedAdminInDb._id });
    await StaffSessionModel.deleteMany({ userId: savedAdminInDb._id });

    // Clean up test data
    await UserModel.deleteMany({
      email: {
        $in: [
          "test.admin@civictrack.org",
          "test.officer@civictrack.org",
          "test.inactive@civictrack.org",
          "new.officer@civictrack.org",
          "concurrent.officer@civictrack.org",
          "revoked.officer@civictrack.org",
        ],
      },
    });
    await StaffSessionModel.deleteMany({ userId: { $in: [adminUser._id, officerUser._id, inactiveStaff._id] } });
    await StaffInvitationModel.deleteMany({
      email: {
        $in: [
          "new.officer@civictrack.org",
          "concurrent.officer@civictrack.org",
          "revoked.officer@civictrack.org",
        ],
      },
    });

    console.log(">>> ALL CUSTOM STAFF JWT & RBAC TESTS PASSED SUCCESSFULLY! <<<\n");
  } finally {
    await disconnectDatabase();
  }
}

runStaffAuthTests().catch((err: unknown) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
