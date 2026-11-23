import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { StaffAuthService } from "../modules/staff-auth/staff-auth.service.js";
import { UserModel } from "../modules/users/user.model.js";
import { DepartmentModel } from "../modules/departments/department.model.js";
import { UserRole } from "@civictrack/contracts";

async function main(): Promise<void> {
  const email = process.argv[2];
  const roleInput = (process.argv[3] || "OFFICER").toUpperCase();
  const deptCode = process.argv[4];

  if (!email || !email.includes("@")) {
    console.log("\n=======================================================");
    console.log("CivicTrack Staff Invitation Generator CLI");
    console.log("=======================================================");
    console.log("Usage:   npx tsx src/scripts/create-invite.ts <email> [OFFICER|ADMIN] [deptCode]");
    console.log("Example: npx tsx src/scripts/create-invite.ts newofficer@civictrack.gov.in OFFICER TRANS");
    console.log("Example: npx tsx src/scripts/create-invite.ts newadmin@civictrack.gov.in ADMIN\n");
    process.exit(1);
  }

  const role = roleInput === "ADMIN" ? UserRole.ADMIN : UserRole.OFFICER;

  const connected = await connectDatabase();
  if (!connected) {
    console.error("Error: Could not connect to MongoDB database.");
    process.exit(1);
  }

  try {
    // Find an administrator to act as the inviting user
    let adminUser = await UserModel.findOne({ role: UserRole.ADMIN, isActive: true });
    if (!adminUser) {
      // Create a temporary platform admin record if none exists
      adminUser = await UserModel.create({
        email: "system.admin@civictrack.gov.in",
        name: "Municipal System Admin",
        role: UserRole.ADMIN,
        isActive: true,
      });
    }

    let departmentId: string | undefined;
    if (role === UserRole.OFFICER) {
      let dept = deptCode ? await DepartmentModel.findOne({ code: deptCode.toUpperCase() }) : null;
      if (!dept) {
        dept = await DepartmentModel.findOne({ isActive: true });
      }
      if (!dept) {
        console.error("Error: No municipal departments found in database. Please run staff seeder or create a department first.");
        process.exit(1);
      }
      departmentId = dept._id.toString();
      console.log(`Assigned Department: ${dept.name} (${dept.code})`);
    }

    const result = await StaffAuthService.createInvitation({
      email,
      role,
      departmentId,
      invitedByUserId: adminUser._id.toString(),
      baseUrl: "http://localhost:3000",
    });

    console.log("\n=======================================================");
    console.log("STAFF INVITATION GENERATED SUCCESSFULLY!");
    console.log("=======================================================");
    console.log(`Role:            ${role}`);
    console.log(`Target Email:    ${email}`);
    console.log(`Expires:         7 Days from now`);
    console.log("-------------------------------------------------------");
    console.log(`Single-Use Token: ${result.rawToken}`);
    console.log("-------------------------------------------------------");
    console.log(`Direct Link:     ${result.inviteLink}`);
    console.log("=======================================================\n");
  } catch (err: any) {
    console.error("Failed to generate staff invitation:", err.message || err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
