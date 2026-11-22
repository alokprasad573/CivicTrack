import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { UserService } from "../modules/users/user.service.js";
import { logger } from "../common/utils/logger.js";

async function main(): Promise<void> {
  const email = process.argv[2];
  const name = process.argv[3] || "Platform Admin";

  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx src/scripts/bootstrap-admin.ts <admin-email> [admin-name]");
    process.exit(1);
  }

  logger.info(`Bootstrapping admin user for email: ${email}`);

  const connected = await connectDatabase();
  if (!connected) {
    logger.error("Could not connect to database to bootstrap admin");
    process.exit(1);
  }

  try {
    const adminUser = await UserService.bootstrapAdmin(email, name);
    logger.info("Admin user successfully bootstrapped:", {
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: adminUser.role,
      name: adminUser.name,
    });
  } catch (error) {
    logger.error("Error during admin bootstrap:", { error });
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
