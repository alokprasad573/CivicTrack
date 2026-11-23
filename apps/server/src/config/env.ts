import { config } from "dotenv";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";

// Look for .env in apps/server/.env if running from monorepo root, or .env in current directory
const candidatePaths = [
  path.resolve(process.cwd(), "apps/server/.env"),
  path.resolve(process.cwd(), ".env"),
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),

  // Database
  ATLAS_URI: z.string().optional(),

  // Clerk Authentication (Citizens)
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),

  // Custom JWT Authentication (Staff: Admin & Officer)
  STAFF_JWT_ACCESS_SECRET: z.string().default("civictrack_staff_jwt_access_secret_dev_32char_key!"),
  STAFF_JWT_REFRESH_SECRET: z.string().default("civictrack_staff_jwt_refresh_secret_dev_32char_key!"),
  STAFF_JWT_ACCESS_EXPIRY: z.string().default("15m"),
  STAFF_JWT_REFRESH_EXPIRY: z.string().default("7d"),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("ap-south-2"),
  AWS_S3_BUCKET_NAME: z.string().optional(),

  // Ola Maps
  OLA_MAP_PROJECT_ID: z.string().optional(),
  OLA_MAPS_API_KEY: z.string().optional(),
  OLA_MAP_CLIENT_ID: z.string().optional(),
  OLA_MAP_CLIENT_SECRET: z.string().optional(),

  // Security Flags
  ENABLE_DEV_ROLE_SWITCH: z.string().default("false"),
  ALLOW_TEST_TOKEN_AUTH: z.string().default("false"),
});

export type Env = z.infer<typeof EnvSchema>;

export const DEFAULT_DEV_ACCESS_SECRET = "civictrack_staff_jwt_access_secret_dev_32char_key!";
export const DEFAULT_DEV_REFRESH_SECRET = "civictrack_staff_jwt_refresh_secret_dev_32char_key!";

export function validateProductionRequirements(data: Env): void {
  if (data.NODE_ENV === "production") {
    // 1. Staff JWT Secrets
    if (!data.STAFF_JWT_ACCESS_SECRET || data.STAFF_JWT_ACCESS_SECRET === DEFAULT_DEV_ACCESS_SECRET) {
      throw new Error("Production requires an explicit, non-default STAFF_JWT_ACCESS_SECRET");
    }
    if (!data.STAFF_JWT_REFRESH_SECRET || data.STAFF_JWT_REFRESH_SECRET === DEFAULT_DEV_REFRESH_SECRET) {
      throw new Error("Production requires an explicit, non-default STAFF_JWT_REFRESH_SECRET");
    }
    if (data.STAFF_JWT_ACCESS_SECRET.length < 32) {
      throw new Error("STAFF_JWT_ACCESS_SECRET must be at least 32 characters long in production");
    }
    if (data.STAFF_JWT_REFRESH_SECRET.length < 32) {
      throw new Error("STAFF_JWT_REFRESH_SECRET must be at least 32 characters long in production");
    }
    if (data.STAFF_JWT_ACCESS_SECRET === data.STAFF_JWT_REFRESH_SECRET) {
      throw new Error("STAFF_JWT_ACCESS_SECRET and STAFF_JWT_REFRESH_SECRET must be independent, unique secrets");
    }
    const placeholderPatterns = [/placeholder/i, /change-me/i, /your-secret/i, /example/i];
    for (const pat of placeholderPatterns) {
      if (pat.test(data.STAFF_JWT_ACCESS_SECRET) || pat.test(data.STAFF_JWT_REFRESH_SECRET)) {
        throw new Error("Placeholder secrets are strictly forbidden in production");
      }
    }

    // 2. Database URI
    if (!data.ATLAS_URI || data.ATLAS_URI.trim().length === 0) {
      throw new Error("Production requires an explicitly configured ATLAS_URI");
    }

    // 3. Storage Bucket
    if (!data.AWS_S3_BUCKET_NAME || data.AWS_S3_BUCKET_NAME === "REPLACE_ME") {
      throw new Error("Production requires a valid AWS_S3_BUCKET_NAME");
    }
  }
}

function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("FATAL: Environment validation failed:", JSON.stringify(formatted, null, 2));
    throw new Error("Invalid application environment configuration.");
  }

  validateProductionRequirements(result.data);
  return result.data;
}

export const env = validateEnv();
