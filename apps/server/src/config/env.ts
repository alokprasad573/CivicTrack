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

  // Clerk Authentication
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),

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
});

export type Env = z.infer<typeof EnvSchema>;

function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("FATAL: Environment validation failed:", JSON.stringify(formatted, null, 2));
    throw new Error("Invalid application environment configuration.");
  }
  return result.data;
}

export const env = validateEnv();
