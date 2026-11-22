import { Router } from "express";
import { handleClerkWebhook } from "./clerk-webhook.controller.js";

const router = Router();

// Clerk webhook delivery endpoint
router.post("/clerk", handleClerkWebhook);

export const identityRoutes = router;
