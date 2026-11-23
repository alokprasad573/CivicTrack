import { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { UserModel } from "../modules/users/user.model.js";
import { DepartmentModel } from "../modules/departments/department.model.js";
import { UserRole } from "@civictrack/contracts";
import { logger } from "../common/utils/logger.js";

/**
 * Migration & Backfill Script: Assign Legacy Departments to an Administrator
 * 
 * Usage:
 *   npx tsx apps/server/src/scripts/backfill-department-creators.ts [adminEmailOrId]
 * 
 * If no argument is provided, the script targets the earliest created active Administrator account.
 */
async function backfillDepartmentCreators(): Promise<void> {
  const connected = await connectDatabase();
  if (!connected) {
    logger.error("Database connection failed. Aborting department creator backfill.");
    process.exit(1);
  }

  try {
    const unownedQuery = {
      $or: [
        { createdByAdminId: { $exists: false } },
        { createdByAdminId: null },
      ],
    };

    const unownedDepartments = await DepartmentModel.find(unownedQuery);
    if (unownedDepartments.length === 0) {
      logger.info("All departments currently have an assigned createdByAdminId. No backfill needed.");
      await disconnectDatabase();
      return;
    }

    logger.info(`Found ${unownedDepartments.length} legacy department(s) without an owner admin.`);

    const targetArg = process.argv[2]?.trim();
    let targetAdmin = null;

    if (targetArg) {
      if (Types.ObjectId.isValid(targetArg)) {
        targetAdmin = await UserModel.findOne({
          _id: new Types.ObjectId(targetArg),
          role: UserRole.ADMIN,
          isActive: true,
        });
      }
      if (!targetAdmin) {
        targetAdmin = await UserModel.findOne({
          email: targetArg.toLowerCase(),
          role: UserRole.ADMIN,
          isActive: true,
        });
      }
      if (!targetAdmin) {
        logger.error(`Specified admin '${targetArg}' was not found or is not an active administrator.`);
        await disconnectDatabase();
        process.exit(1);
      }
    } else {
      // Default: Find the earliest created active administrator
      targetAdmin = await UserModel.findOne({
        role: UserRole.ADMIN,
        isActive: true,
      }).sort({ createdAt: 1 });

      if (!targetAdmin) {
        logger.error("No active administrator accounts found in the database to assign legacy departments.");
        await disconnectDatabase();
        process.exit(1);
      }
    }

    logger.info("Target administrator for legacy departments backfill:", {
      adminId: targetAdmin._id.toString(),
      email: targetAdmin.email,
      name: targetAdmin.name,
    });

    const result = await DepartmentModel.updateMany(unownedQuery, {
      $set: { createdByAdminId: targetAdmin._id },
    });

    logger.info(`Successfully updated ${result.modifiedCount} legacy department(s).`, {
      assignedToAdminId: targetAdmin._id.toString(),
      affectedDepartmentCodes: unownedDepartments.map((d) => d.code),
    });
  } catch (err) {
    logger.error("Error during department creator backfill", { error: err });
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

backfillDepartmentCreators();
