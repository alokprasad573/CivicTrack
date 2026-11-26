/**
 * Helpers for safe, origin-aware navigation into and back out of `/map`.
 */

/**
 * Validates that a return path is a safe same-origin relative path and does not loop onto `/map`.
 */
export function getSafeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://civictrack.local");
    if (parsed.origin !== "https://civictrack.local") return null;
    if (parsed.pathname === "/map" || parsed.pathname.startsWith("/map/")) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/**
 * Attaches the originating pathname as a `from` query parameter when linking to `/map`.
 */
export function buildMapReturnHref(
  targetHref: string,
  fromPathname: string | null | undefined
): string {
  if (targetHref !== "/map") return targetHref;
  const safeFrom = getSafeInternalPath(fromPathname);
  if (!safeFrom) return targetHref;
  return `/map?from=${encodeURIComponent(safeFrom)}`;
}

/**
 * Derives a clear, contextual back-link label for the `/map` header control.
 */
export function getMapBackLabel(
  targetPath: string | null,
  canUseHistory: boolean
): string {
  if (!targetPath) {
    return canUseHistory ? "Back" : "Back to Home";
  }
  if (targetPath === "/") return "Back to Home";
  if (targetPath.startsWith("/admin")) return "Back to Admin";
  if (targetPath.startsWith("/officer")) return "Back to Officer";
  if (targetPath.startsWith("/citizen")) return "Back to Citizen";
  if (targetPath.startsWith("/sign-up")) return "Back to Sign Up";
  if (targetPath.startsWith("/sign-in")) return "Back to Sign In";
  return "Back";
}
