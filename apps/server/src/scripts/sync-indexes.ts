import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { ComplaintModel } from "../modules/complaints/complaint.model.js";
import { UserModel } from "../modules/users/user.model.js";
import { DepartmentModel } from "../modules/departments/department.model.js";
import { StaffSessionModel } from "../modules/staff-auth/staff-session.model.js";
import { logger } from "../common/utils/logger.js";

/**
 * Utility script to explicitly build and synchronize database indexes,
 * including 2dsphere spatial index on complaints collection.
 * 
 * Usage:
 *   npx tsx apps/server/src/scripts/sync-indexes.ts
 */
async function syncAllIndexes(): Promise<void> {
  const connected = await connectDatabase();
  if (!connected) {
    logger.error("Database connection failed. Unable to sync indexes.");
    process.exit(1);
  }

  try {
    logger.info("Synchronizing database indexes across all collections...");

    logger.info("1. Syncing ComplaintModel indexes (including 2dsphere location index)...");
    await ComplaintModel.createIndexes();
    const complaintIndexes = await ComplaintModel.collection.indexes();
    logger.info("   -> Complaint indexes synchronized", {
      indexNames: complaintIndexes.map((i) => i.name),
    });

    logger.info("2. Syncing UserModel indexes...");
    await UserModel.createIndexes();

    logger.info("3. Syncing DepartmentModel indexes...");
    await DepartmentModel.createIndexes();

    logger.info("4. Syncing StaffSessionModel indexes...");
    await StaffSessionModel.createIndexes();

    logger.info("All collection indexes synchronized successfully!");
  } catch (err) {
    logger.error("Failed to synchronize database indexes", { error: err });
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

syncAllIndexes();
