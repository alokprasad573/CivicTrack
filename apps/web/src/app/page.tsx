import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import {
  MapPin,
  ArrowRight,
  LogIn,
  UserPlus,
  LayoutDashboard,
  CheckCircle2,
  Camera,
  Wrench,
  Building2,
  Landmark,
} from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-blue-600/15 selection:text-blue-700">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-3 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-700/20 bg-blue-600 text-white">
              <Landmark className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                CivicTrack
              </span>
              <span className="hidden text-xs text-slate-600 sm:block">
                Smart city civic issue resolution platform
              </span>
            </div>
          </Link>

          <nav aria-label="Primary actions" className="flex items-center gap-2.5">
            {!isSignedIn ? (
              <>
                <Link
                  href="/sign-in"
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 shadow-hairline transition-colors hover:bg-slate-50 sm:px-4 sm:text-sm"
                >
                  <LogIn className="h-4 w-4 text-slate-500" />
                  <span>Citizen Sign In</span>
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-hairline transition-[background-color,transform] duration-150 hover:bg-blue-700 active:scale-[0.98] sm:px-4 sm:text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/citizen"
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-hairline transition-[background-color,transform] duration-150 hover:bg-blue-700 active:scale-[0.98] sm:px-4 sm:text-sm"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Citizen Dashboard</span>
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox:
                        "h-8 w-8 ring-1 ring-slate-200 bg-blue-600 text-white [&_*]:text-white [&_svg]:fill-white",
                      userButtonTrigger:
                        "min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full",
                    },
                  }}
                />
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Section 1: Hero */}
        <section className="border-b border-slate-200/80 bg-blue-600 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              {/* Left Column: Heading, Value Prop, CTAs */}
              <div className="space-y-6 lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-hairline">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                  <span>Bridging citizens and municipal governance</span>
                </div>

                <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Report local issues.
                  <br />
                  <span className="text-white">Track when they get fixed.</span>
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-slate-900 sm:text-lg">
                  Notice a pothole, broken streetlight, or water leak? CivicTrack sends your report
                  directly to the right municipal department and keeps you informed until the repair
                  is complete.
                </p>

                {/* Primary & Secondary Actions */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Link
                    href={isSignedIn ? "/citizen/report" : "/sign-up"}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-blue-600 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-hairline transition-[background-color,transform] duration-150 hover:bg-blue-700 active:scale-[0.98]"
                  >
                    <span>Report an Issue</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/map"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-hairline transition-colors hover:bg-slate-50"
                  >
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>Explore City Map</span>
                  </Link>
                </div>

                {/* Benefits Row */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-200/80 pt-6 text-xs text-slate-900 font-semibold sm:text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span>Free for all residents</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-300" />
                    <span>Precise map location</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span>Photo proof on completion</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Civic Service Overview Panel */}
              <div className="lg:col-span-5">
                <div className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-elevated sm:p-8">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full bg-emerald-600"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-semibold text-slate-900">
                        Active city services
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Live tracking
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
                      <p className="mb-1 text-sm font-semibold text-slate-900">
                        Direct department dispatch
                      </p>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Reports are verified and routed straight to the responsible team — roads,
                        sanitation, electricity, or water.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
                      <p className="mb-1 text-sm font-semibold text-slate-900">
                        Clear target response times
                      </p>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Every category has a target resolution timeframe so issues are addressed
                        without unnecessary delays.
                      </p>
                    </div>
                  </div>

                  {/* Staff portal sign in quick links */}
                  <div className="space-y-2.5 border-t border-slate-200/80 pt-4">
                    <p className="text-xs font-medium text-slate-600">
                      Are you municipal staff?
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Link
                        href="/admin/login"
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 shadow-hairline transition-colors hover:bg-slate-50"
                      >
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span>Admin Portal</span>
                      </Link>
                      <Link
                        href="/officer/login"
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100 px-3 py-2.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-200/70"
                      >
                        <Wrench className="h-4 w-4 text-slate-600" />
                        <span>Field Officer</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: How It Works in 3 Simple Steps */}
        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
              <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Simple 3-step process
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                How CivicTrack Works
              </h2>
              <p className="text-sm text-slate-600 sm:text-base">
                From spotting an issue in your neighborhood to seeing it repaired.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Step 1 */}
              <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-6 shadow-hairline sm:p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50 text-blue-600">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium tabular-nums text-blue-700">Step 1</span>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                    Take a Photo &amp; Describe
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  Choose the category (road, water, lights, trash) and attach photos showing what
                  needs attention.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-6 shadow-hairline sm:p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50 text-blue-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium tabular-nums text-blue-700">Step 2</span>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                    Pin the Exact Location
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  Click on the interactive city map or use your device GPS so field teams know
                  exactly where to go.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-6 shadow-hairline sm:p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium tabular-nums text-emerald-700">Step 3</span>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                    Follow the Repair
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  Get updates as municipal officers arrive on-site, perform the repair, and upload
                  completion proof.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Municipal Roles Overview */}
        <section className="border-t border-slate-200/80 bg-background py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-8 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-hairline sm:p-10">
              <div className="space-y-1.5 border-b border-slate-200/80 pb-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  Portals for citizens and city teams
                </h2>
                <p className="text-sm text-slate-600">
                  Dedicated entry points for residents, municipal administrators, and field officers.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 divide-y divide-slate-200/80 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                <div className="space-y-3 lg:pr-6">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                    <h3 className="text-base font-semibold text-slate-900">Citizen Portal</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Report local problems in a few taps and track progress until they are solved.
                  </p>
                  <Link
                    href="/citizen"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    <span>Open Citizen Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-3 pt-6 lg:px-6 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" />
                    <h3 className="text-base font-semibold text-slate-900">
                      Municipal Administration
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Review incoming reports, assign field teams, manage staff, and track resolution
                    times.
                  </p>
                  <Link
                    href="/admin/login"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    <span>Sign in as Administrator</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-3 pt-6 lg:pl-6 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-600" aria-hidden="true" />
                    <h3 className="text-base font-semibold text-slate-900">Field Operations</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    View assigned tasks, navigate to incident locations, and upload photo proof upon
                    completion.
                  </p>
                  <Link
                    href="/officer/login"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    <span>Sign in as Field Officer</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-600 sm:flex-row sm:px-6 lg:px-8">
          <p className="tabular-nums">
            &copy; {new Date().getFullYear()} CivicTrack &middot; Smart City Civic Issue Resolution
            Platform
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/citizen"
              className="inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Citizen Portal
            </Link>
            <span aria-hidden="true" className="text-slate-300">
              &middot;
            </span>
            <Link
              href="/admin/login"
              className="inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Staff Login
            </Link>
            <span aria-hidden="true" className="text-slate-300">
              &middot;
            </span>
            <Link
              href="/map"
              className="inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              City Map
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
