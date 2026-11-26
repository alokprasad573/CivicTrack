import { Router } from "express";
import { MapsController } from "./maps.controller.js";
import { authWebhookRateLimiter } from "../../common/middleware/rate-limit.middleware.js";

const router = Router();

router.use(authWebhookRateLimiter);

router.get("/reverse-geocode", MapsController.reverseGeocode);
router.get("/geocode", MapsController.forwardGeocode);
router.post("/directions", MapsController.getDirections);
router.get("/status", MapsController.getStatus);

export const mapRoutes = router;
