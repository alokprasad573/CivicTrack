import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { UserModel } from "../modules/users/user.model.js";
import { DepartmentModel } from "../modules/departments/department.model.js";
import { UserRole, ComplaintCategory } from "@civictrack/contracts";
import { logger } from "../common/utils/logger.js";

async function seedStaff(): Promise<void> {
  const connected = await connectDatabase();
  if (!connected) {
    logger.error("Failed to connect to database for staff seeding");
    process.exit(1);
  }

  try {
    logger.info("Starting staff account provisioning...");

    // 0. Ensure clerkUserId index is sparse to allow multiple staff accounts without Clerk IDs
    try {
      const indexes = await UserModel.collection.indexes();
      const clerkIdx = indexes.find((idx) => idx.name === "clerkUserId_1");
      if (clerkIdx && !clerkIdx.sparse) {
        await UserModel.collection.dropIndex("clerkUserId_1");
        logger.info("Dropped legacy non-sparse clerkUserId_1 index");
        await UserModel.syncIndexes();
        logger.info("Recreated clerkUserId index with sparse: true");
      }
    } catch (idxErr) {
      logger.warn("Index migration notice", { error: idxErr });
    }

    // 1. Ensure core departments exist
    let transportDept = await DepartmentModel.findOne({ code: "TRANS" });
    if (!transportDept) {
      transportDept = await DepartmentModel.create({
        name: "Department of Transportation",
        code: "TRANS",
        categories: [ComplaintCategory.ROADS_POTHOLES, ComplaintCategory.STREETLIGHTS],
        isActive: true,
      });
      logger.info("Created Transportation department", { id: transportDept._id.toString() });
    }

    let sanitationDept = await DepartmentModel.findOne({ code: "SWM" });
    if (!sanitationDept) {
      sanitationDept = await DepartmentModel.create({
        name: "Solid Waste Management",
        code: "SWM",
        categories: [ComplaintCategory.GARBAGE_SANITATION, ComplaintCategory.DRAINAGE_SEWAGE],
        isActive: true,
      });
      logger.info("Created Waste Management department", { id: sanitationDept._id.toString() });
    }

    // 2. Provision Municipal Administrator
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@civictrack.gov.in";
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin@123456";
    const adminHash = await bcrypt.hash(initialAdminPassword, 10);

    let adminUser = await UserModel.findOne({ email: adminEmail }).select("+passwordHash");
    if (adminUser) {
      adminUser.name = "Chief Municipal Administrator";
      adminUser.role = UserRole.ADMIN;
      adminUser.isActive = true;
      if (!adminUser.passwordHash) {
        adminUser.passwordHash = adminHash;
        logger.info("Set initial password for Administrator account", { email: adminEmail });
      }
      await adminUser.save();
      logger.info("Preserved existing Administrator account state", { email: adminEmail });
    } else {
      adminUser = await UserModel.create({
        email: adminEmail,
        name: "Chief Municipal Administrator",
        role: UserRole.ADMIN,
        passwordHash: adminHash,
        isActive: true,
      });
      logger.info("Provisioned initial Administrator account", { email: adminEmail });
    }

    // 3. Provision Field Officer (Transport)
    const officerEmail = process.env.INITIAL_OFFICER_EMAIL || "officer.transport@civictrack.gov.in";
    const initialOfficerPassword = process.env.INITIAL_OFFICER_PASSWORD || "Officer@123456";
    const officerHash = await bcrypt.hash(initialOfficerPassword, 10);

    let officerUser = await UserModel.findOne({ email: officerEmail }).select("+passwordHash");
    if (officerUser) {
      officerUser.name = "Officer Rajesh Kumar";
      officerUser.role = UserRole.OFFICER;
      officerUser.departmentId = transportDept._id;
      officerUser.isActive = true;
      if (!officerUser.passwordHash) {
        officerUser.passwordHash = officerHash;
        logger.info("Set initial password for Transport Officer", { email: officerEmail });
      }
      await officerUser.save();
      logger.info("Preserved existing Transport Officer account state", { email: officerEmail });
    } else {
      officerUser = await UserModel.create({
        email: officerEmail,
        name: "Officer Rajesh Kumar",
        role: UserRole.OFFICER,
        departmentId: transportDept._id,
        passwordHash: officerHash,
        isActive: true,
      });
      logger.info("Provisioned initial Transport Officer account", { email: officerEmail });
    }

    // 4. Provision Field Officer (Sanitation)
    const sanitationOfficerEmail = "officer.sanitation@civictrack.gov.in";
    let sanitationOfficer = await UserModel.findOne({ email: sanitationOfficerEmail }).select("+passwordHash");
    if (sanitationOfficer) {
      sanitationOfficer.name = "Officer Priya Sharma";
      sanitationOfficer.role = UserRole.OFFICER;
      sanitationOfficer.departmentId = sanitationDept._id;
      sanitationOfficer.isActive = true;
      if (!sanitationOfficer.passwordHash) {
        sanitationOfficer.passwordHash = officerHash;
        logger.info("Set initial password for Sanitation Officer", { email: sanitationOfficerEmail });
      }
      await sanitationOfficer.save();
      logger.info("Preserved existing Sanitation Officer account state", { email: sanitationOfficerEmail });
    } else {
      sanitationOfficer = await UserModel.create({
        email: sanitationOfficerEmail,
        name: "Officer Priya Sharma",
        role: UserRole.OFFICER,
        departmentId: sanitationDept._id,
        passwordHash: officerHash,
        isActive: true,
      });
      logger.info("Provisioned initial Sanitation Officer account", { email: sanitationOfficerEmail });
    }

    logger.info("=== STAFF PROVISIONING COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Staff provisioning failed:", err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

seedStaff().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
