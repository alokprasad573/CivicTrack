import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/how-it-works",
  "/admin/login",
  "/admin/register",
  "/officer/login",
  "/officer/register",
  "/map",
  "/api",
  "/docs",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix));
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 1. Staff: Admin portal guard (Custom JWT cookie)
  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login") &&
    !pathname.startsWith("/admin/register")
  ) {
    const adminToken = req.cookies.get("civictrack_admin_token")?.value;
    if (!adminToken) {
      const loginUrl = new URL("/admin/login", req.url);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("returnTo", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Staff: Officer portal guard (Custom JWT cookie)
  if (
    pathname.startsWith("/officer") &&
    !pathname.startsWith("/officer/login") &&
    !pathname.startsWith("/officer/register")
  ) {
    const officerToken = req.cookies.get("civictrack_officer_token")?.value;
    if (!officerToken) {
      const loginUrl = new URL("/officer/login", req.url);
      if (pathname !== "/officer") {
        loginUrl.searchParams.set("returnTo", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Citizen portal: Strictly guarded by Clerk
  if (pathname.startsWith("/citizen")) {
    await auth.protect();
    return NextResponse.next();
  }

  // 4. General fallback: Protect non-public routes with Clerk
  if (!isPublicPath(pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
