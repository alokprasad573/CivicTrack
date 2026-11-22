import { env } from "./env.js";

/**
 * Checks whether live Ola Maps API credentials are configured with non-placeholder values
 */
export function isOlaMapsConfigured(): boolean {
  if (
    env.OLA_MAPS_API_KEY &&
    env.OLA_MAPS_API_KEY !== "REPLACE_ME" &&
    env.OLA_MAPS_API_KEY.length > 5
  ) {
    return true;
  }

  if (
    env.OLA_MAP_CLIENT_ID &&
    env.OLA_MAP_CLIENT_SECRET &&
    env.OLA_MAP_CLIENT_ID !== "REPLACE_ME" &&
    env.OLA_MAP_CLIENT_SECRET !== "REPLACE_ME"
  ) {
    return true;
  }

  return false;
}

export function getOlaMapsApiKey(): string | undefined {
  if (env.OLA_MAPS_API_KEY && env.OLA_MAPS_API_KEY !== "REPLACE_ME") {
    return env.OLA_MAPS_API_KEY;
  }
  return undefined;
}
