import { Request, Response, NextFunction } from "express";
import { Webhook } from "svix";
import { env } from "../../config/env.js";
import { UserService } from "../users/user.service.js";
import { ValidationError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

interface ClerkEmailObject {
  id: string;
  email_address: string;
}

interface ClerkWebhookPayload {
  data: {
    id: string;
    email_addresses?: ClerkEmailObject[];
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    [key: string]: unknown;
  };
  type: string;
  [key: string]: unknown;
}

/**
 * Clerk Webhook Controller
 * 
 * Securely verifies webhook signatures using Svix and CLERK_WEBHOOK_SIGNING_SECRET.
 * Provides idempotent synchronization of user accounts.
 */
export async function handleClerkWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      logger.error("CLERK_WEBHOOK_SIGNING_SECRET is not configured");
      throw new ValidationError("Webhook secret not configured on server");
    }

    // Svix headers
    const svixId = req.header("svix-id");
    const svixTimestamp = req.header("svix-timestamp");
    const svixSignature = req.header("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      logger.warn("Missing Svix signature headers on webhook request");
      throw new ValidationError("Missing required webhook signature headers");
    }

    // Verify raw payload with Svix (throws if signature is invalid)
    const rawPayload = req.rawBody || JSON.stringify(req.body);
    const wh = new Webhook(signingSecret);

    try {
      wh.verify(rawPayload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (verifyErr) {
      const msg = verifyErr instanceof Error ? verifyErr.message : "Invalid signature";
      logger.warn("Clerk webhook signature verification failed", { error: msg, svixId });
      throw new ValidationError("Invalid webhook signature");
    }

    const evt: ClerkWebhookPayload =
      typeof req.body === "object" && req.body !== null
        ? (req.body as ClerkWebhookPayload)
        : (JSON.parse(rawPayload) as ClerkWebhookPayload);

    const { type, data } = evt;
    logger.info(`Processing Clerk webhook event: ${type}`, { eventId: svixId, clerkUserId: data.id });

    switch (type) {
      case "user.created":
      case "user.updated": {
        const primaryEmail =
          data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ||
          data.email_addresses?.[0]?.email_address;

        if (!primaryEmail) {
          logger.warn("Clerk user webhook event missing email address", { clerkUserId: data.id });
          break;
        }

        const fullName =
          [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
          data.username ||
          primaryEmail.split("@")[0] ||
          "Citizen";

        await UserService.syncFromClerk({
          clerkUserId: data.id,
          email: primaryEmail,
          name: fullName,
        });
        break;
      }

      case "user.deleted": {
        await UserService.deactivateUser(data.id);
        break;
      }

      default:
        logger.debug(`Unhandled Clerk webhook event type: ${type}`);
        break;
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    next(error);
  }
}
