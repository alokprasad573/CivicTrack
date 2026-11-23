import request from "supertest";
import { app } from "../src/app.js";
import { AdminRegisterSchema } from "@civictrack/contracts";
import { UserModel } from "../src/modules/users/user.model.js";
import { StaffSessionModel } from "../src/modules/staff-auth/staff-session.model.js";
import { StaffAuthService } from "../src/modules/staff-auth/staff-auth.service.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";

async function runAdminRegisterTests(): Promise<void> {
  console.log("Running Admin Registration Name Field Verification Tests...\n");

  // =========================================================================
  // 1. DETERMINISTIC SCHEMA VALIDATION (OFFLINE)
  // =========================================================================
  console.log("1. Testing AdminRegisterSchema validation rules:");

  // Valid registration payload
  const validPayload = {
    name: "Dr. Evelyn Reed",
    email: "evelyn.admin@civictrack.gov",
    password: "Password@123",
    confirmPassword: "Password@123",
  };
  const validRes = AdminRegisterSchema.safeParse(validPayload);
  if (!validRes.success) {
    throw new Error(`Expected valid payload to pass schema, got error: ${JSON.stringify(validRes.error)}`);
  }
  if (validRes.data.name !== "Dr. Evelyn Reed") {
    throw new Error(`Expected name to be trimmed/preserved as 'Dr. Evelyn Reed', got '${validRes.data.name}'`);
  }
  console.log("   -> Valid payload with real name accepted by AdminRegisterSchema");

  // Rejection of missing name
  const missingNameRes = AdminRegisterSchema.safeParse({
    email: "test@civictrack.gov",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (missingNameRes.success) {
    throw new Error("FAILED: AdminRegisterSchema must reject payload missing 'name'");
  }
  console.log("   -> Missing name rejected by AdminRegisterSchema");

  // Rejection of empty string name
  const emptyNameRes = AdminRegisterSchema.safeParse({
    ...validPayload,
    name: "",
  });
  if (emptyNameRes.success) {
    throw new Error("FAILED: AdminRegisterSchema must reject empty string name");
  }
  console.log("   -> Empty string name rejected by AdminRegisterSchema");

  // Rejection of whitespace-only name
  const whitespaceNameRes = AdminRegisterSchema.safeParse({
    ...validPayload,
    name: "    ",
  });
  if (whitespaceNameRes.success) {
    throw new Error("FAILED: AdminRegisterSchema must reject whitespace-only name");
  }
  console.log("   -> Whitespace-only name rejected by AdminRegisterSchema");

  // Rejection of name exceeding 120 characters
  const tooLongName = "A".repeat(121);
  const tooLongRes = AdminRegisterSchema.safeParse({
    ...validPayload,
    name: tooLongName,
  });
  if (tooLongRes.success) {
    throw new Error("FAILED: AdminRegisterSchema must reject name exceeding 120 characters");
  }
  console.log("   -> Name exceeding 120 characters rejected by AdminRegisterSchema\n");

  // =========================================================================
  // 2. HTTP ENDPOINT VALIDATION (OFFLINE HTTP REQUESTS)
  // =========================================================================
  console.log("2. Testing POST /api/v1/admin/auth/register endpoint validation:");

  // Endpoint rejects missing name
  const httpMissingName = await request(app)
    .post("/api/v1/admin/auth/register")
    .send({
      email: "admin.noname@civictrack.gov",
      password: "Password@123",
      confirmPassword: "Password@123",
    });
  if (httpMissingName.status !== 400 || httpMissingName.body.error?.code !== "VALIDATION_ERROR") {
    throw new Error(`Expected 400 VALIDATION_ERROR for missing name, got ${httpMissingName.status}`);
  }
  console.log("   -> POST /api/v1/admin/auth/register without name rejected with HTTP 400");

  // Endpoint rejects blank name
  const httpBlankName = await request(app)
    .post("/api/v1/admin/auth/register")
    .send({
      name: "   \t  ",
      email: "admin.blankname@civictrack.gov",
      password: "Password@123",
      confirmPassword: "Password@123",
    });
  if (httpBlankName.status !== 400 || httpBlankName.body.error?.code !== "VALIDATION_ERROR") {
    throw new Error(`Expected 400 VALIDATION_ERROR for blank name, got ${httpBlankName.status}`);
  }
  console.log("   -> POST /api/v1/admin/auth/register with whitespace-only name rejected with HTTP 400");

  // Endpoint rejects name > 120 characters
  const httpTooLongName = await request(app)
    .post("/api/v1/admin/auth/register")
    .send({
      name: "X".repeat(121),
      email: "admin.toolong@civictrack.gov",
      password: "Password@123",
      confirmPassword: "Password@123",
    });
  if (httpTooLongName.status !== 400 || httpTooLongName.body.error?.code !== "VALIDATION_ERROR") {
    throw new Error(`Expected 400 VALIDATION_ERROR for 121-char name, got ${httpTooLongName.status}`);
  }
  console.log("   -> POST /api/v1/admin/auth/register with 121-char name rejected with HTTP 400\n");

  // =========================================================================
  // 3. SERVICE LEVEL UNIT VALIDATION
  // =========================================================================
  console.log("3. Testing StaffAuthService.adminRegister validation guards:");
  let serviceMissingFailed = false;
  try {
    await StaffAuthService.adminRegister({
      name: "   ",
      email: "service.test@civictrack.gov",
      password: "Password@123",
    });
  } catch (err: any) {
    serviceMissingFailed = true;
    if (!err.message.includes("Name is required")) {
      throw new Error(`Unexpected service error message: ${err.message}`);
    }
  }
  if (!serviceMissingFailed) {
    throw new Error("FAILED: StaffAuthService.adminRegister must reject blank name");
  }
  console.log("   -> StaffAuthService.adminRegister directly enforces non-empty name\n");

  // =========================================================================
  // 4. DATABASE INTEGRATION: REAL NAME PERSISTENCE
  // =========================================================================
  const connected = await connectDatabase();
  if (!connected) {
    console.log("⚠️ Database offline. Skipping live DB real-name storage test.");
    return;
  }

  try {
    console.log("4. Testing Live MongoDB Real-Name Persistence on Registration:");
    const testAdminEmail = `admin.realname.${Date.now()}@civictrack.test`;
    const realAdminName = "Marcus Vance, City Commissioner";

    const regRes = await request(app)
      .post("/api/v1/admin/auth/register")
      .send({
        name: `   ${realAdminName}   `, // testing trimming
        email: testAdminEmail,
        password: "StrongAdmin@123",
        confirmPassword: "StrongAdmin@123",
      });

    if (regRes.status !== 201 || !regRes.body.data?.user) {
      throw new Error(`Expected 201 Created from registration, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    }

    // Verify response user object contains the real name
    if (regRes.body.data.user.name !== realAdminName) {
      throw new Error(
        `FAILED: Response user.name must be trimmed real name '${realAdminName}', got '${regRes.body.data.user.name}'`
      );
    }
    console.log("   -> HTTP 201 response returned real trimmed name:", regRes.body.data.user.name);

    // Verify database document stores the real name, NOT default "admin" or "Administrator"
    const savedAdmin = await UserModel.findOne({ email: testAdminEmail });
    if (!savedAdmin) {
      throw new Error("FAILED: Administrator user document was not found in database!");
    }

    if (savedAdmin.name === "admin" || savedAdmin.name === "Administrator") {
      throw new Error(`FAILED: Database document stored default fallback '${savedAdmin.name}' instead of real name!`);
    }

    if (savedAdmin.name !== realAdminName) {
      throw new Error(`FAILED: Database document stored '${savedAdmin.name}', expected '${realAdminName}'`);
    }
    console.log("   -> MongoDB User document verified: name is exactly saved as:", savedAdmin.name);

    // Cleanup test user & sessions
    await UserModel.deleteOne({ _id: savedAdmin._id });
    await StaffSessionModel.deleteMany({ userId: savedAdmin._id });

    console.log("\n>>> ALL ADMIN REGISTRATION REAL NAME TESTS PASSED! <<<\n");
  } finally {
    await disconnectDatabase();
  }
}

runAdminRegisterTests().catch((err) => {
  console.error("Admin Registration Name test failed:", err);
  process.exit(1);
});
