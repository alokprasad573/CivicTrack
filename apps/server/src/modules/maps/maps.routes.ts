import { Router } from "express";
import { MapsController } from "./maps.controller.js";

const router = Router();

router.get("/reverse-geocode", MapsController.reverseGeocode);
router.get("/geocode", MapsController.forwardGeocode);
router.post("/directions", MapsController.getDirections);
router.get("/status", MapsController.getStatus);

export const mapRoutes = router;
