import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/how-it-works(.*)",
  "/admin/login(.*)",
  "/admin/register(.*)",
  "/officer/login(.*)",
  "/officer/register(.*)",
  "/map(.*)",
  "/api(.*)",
  "/docs(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isOfficerRoute = createRouteMatcher(["/officer(.*)"]);
const isCitizenRoute = createRouteMatcher(["/citizen(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 1. Staff: Admin portal guard (Custom JWT cookie)
  if (
    isAdminRoute(req) &&
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
    isOfficerRoute(req) &&
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
  if (isCitizenRoute(req)) {
    await auth.protect();
    return NextResponse.next();
  }

  // 4. General fallback: Protect non-public routes with Clerk
  if (!isPublicRoute(req)) {
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
