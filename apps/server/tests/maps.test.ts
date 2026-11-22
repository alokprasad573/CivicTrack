import request from "supertest";
import { app } from "../src/app.js";
import {
  calculateDistanceMeters,
  OlaMapsAdapter,
} from "../src/modules/maps/ola-maps.adapter.js";
import { Coordinates } from "@civictrack/contracts";

async function runMapTests(): Promise<void> {
  console.log("Running Phase 6 Ola Maps & Geospatial Routing Verification Tests...\n");

  // 1. Unit Test: Haversine ground distance calculation
  console.log("1. Mathematical & Spatial Distance Verification");
  const mgRoad: Coordinates = [77.5975, 12.9732];
  const airport: Coordinates = [77.7064, 13.1986];
  const distance = calculateDistanceMeters(mgRoad, airport);

  console.log(`   Calculated distance between MG Road and BLR Airport: ${(distance / 1000).toFixed(2)} km`);
  // Expected distance is ~27-30km
  if (distance < 25000 || distance > 32000) {
    throw new Error(`Failed: Haversine distance ${distance}m is outside expected range (25-32km)`);
  }
  console.log("   -> Haversine distance algorithm verified accurate\n");

  // 2. Reverse Geocoding Endpoint
  console.log("2. GET /api/v1/maps/reverse-geocode");

  // 2a. Invalid coordinate bounds must be rejected
  const invalidGeoRes = await request(app).get("/api/v1/maps/reverse-geocode?lng=999&lat=12.9716");
  console.log("   GET /api/v1/maps/reverse-geocode (invalid lng 999):", invalidGeoRes.status);
  if (invalidGeoRes.status !== 400) {
    throw new Error("Failed: Out-of-bounds coordinate was not rejected with 400");
  }

  // 2b. Valid coordinates must return 200 with formatted address
  const validGeoRes = await request(app).get("/api/v1/maps/reverse-geocode?lng=77.5946&lat=12.9716");
  console.log("   GET /api/v1/maps/reverse-geocode (valid):", validGeoRes.status);
  if (
    validGeoRes.status !== 200 ||
    !validGeoRes.body.success ||
    !validGeoRes.body.data.formattedAddress
  ) {
    throw new Error("Failed: Valid reverse geocoding request did not return formatted address");
  }
  console.log(`   -> Formatted Address: "${validGeoRes.body.data.formattedAddress}"\n`);

  // 3. Forward Geocoding Endpoint
  console.log("3. GET /api/v1/maps/geocode");
  const geocodeRes = await request(app).get("/api/v1/maps/geocode?query=Indiranagar 100 Feet Road");
  console.log("   GET /api/v1/maps/geocode:", geocodeRes.status);
  if (
    geocodeRes.status !== 200 ||
    !geocodeRes.body.success ||
    !Array.isArray(geocodeRes.body.data) ||
    geocodeRes.body.data.length === 0
  ) {
    throw new Error("Failed: Forward geocoding request failed to return search matches");
  }
  console.log(`   -> Suggestions returned: ${geocodeRes.body.data.length} match(es)\n`);

  // 4. Directions & Turn-by-Turn Routing Service
  console.log("4. POST /api/v1/maps/directions");

  // 4a. Out-of-bounds coordinates must be rejected
  const invalidRouteRes = await request(app)
    .post("/api/v1/maps/directions")
    .send({
      origin: [200, 12.97],
      destination: [77.6, 12.98],
    });
  if (invalidRouteRes.status !== 400) {
    throw new Error("Failed: Invalid route coordinates not rejected with 400");
  }

  // 4b. Valid directions calculation
  const originCoords: Coordinates = [77.5946, 12.9716];
  const destCoords: Coordinates = [77.6101, 12.9792];

  const routeRes = await request(app)
    .post("/api/v1/maps/directions")
    .send({
      origin: originCoords,
      destination: destCoords,
    });

  console.log("   POST /api/v1/maps/directions:", routeRes.status);
  if (routeRes.status !== 200 || !routeRes.body.success) {
    throw new Error("Failed: Directions route calculation did not return 200 OK");
  }

  const routeData = routeRes.body.data;
  console.log(`   -> Total Distance: ${(routeData.distanceMeters / 1000).toFixed(2)} km`);
  console.log(`   -> Total Duration: ${Math.round(routeData.durationSeconds / 60)} mins`);
  console.log(`   -> Geometry Points: ${routeData.geometry.coordinates.length} waypoints`);
  console.log(`   -> Turn-by-Turn Steps: ${routeData.steps.length} maneuvers`);

  if (routeData.distanceMeters <= 0 || routeData.durationSeconds <= 0) {
    throw new Error("Failed: Non-positive distance or duration returned");
  }

  if (routeData.geometry.type !== "LineString" || routeData.geometry.coordinates.length < 2) {
    throw new Error("Failed: Geometry is not a valid LineString with at least 2 points");
  }

  if (routeData.steps.length < 2) {
    throw new Error("Failed: Expected at least 2 navigation maneuvers (depart and arrive)");
  }

  const lastStep = routeData.steps[routeData.steps.length - 1];
  if (lastStep.maneuver !== "arrive") {
    throw new Error(`Failed: Final step maneuver should be 'arrive', got '${lastStep.maneuver}'`);
  }
  console.log("   -> Route geometry and turn-by-turn maneuvers fully verified\n");

  // 5. System Status Check
  console.log("5. GET /api/v1/maps/status");
  const statusRes = await request(app).get("/api/v1/maps/status");
  console.log("   Status:", statusRes.status);
  console.log("   Body:", JSON.stringify(statusRes.body));
  if (statusRes.status !== 200 || !statusRes.body.success) {
    throw new Error("Failed: Maps status check failed");
  }
  console.log(`   -> Provider: ${statusRes.body.data.provider}`);
  console.log(`   -> Configured: ${statusRes.body.data.isConfigured}\n`);

  console.log("ALL PHASE 6 OLA MAPS & ROUTING TESTS PASSED!\n");
}

runMapTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
