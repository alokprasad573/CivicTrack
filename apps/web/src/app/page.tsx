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
  Sparkles,
  Camera,
  Wrench,
  Building2,
  Landmark,
} from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/85 backdrop-blur-md transition-colors">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-foreground">
                CivicTrack
              </span>
              <span className="text-[10px] font-medium text-muted-foreground -mt-0.5">
                City Issue Resolution System
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-secondary min-h-[44px]"
                >
                  <LogIn className="h-4 w-4 text-muted-foreground" />
                  <span>Citizen Sign In</span>
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.98] min-h-[44px]"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/citizen"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.98] min-h-[44px]"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Citizen Dashboard</span>
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-8 w-8 ring-1 ring-border",
                    },
                  }}
                />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* SECTION 1: HERO */}
        <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28 border-b border-border/80">
          {/* Subtle Ambient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background -z-10" />

          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Heading, Value Prop, CTAs */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Connecting Neighbors & City Services</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.15] tracking-tight">
                  Report local issues. <br />
                  <span className="text-primary">Track when they get fixed.</span>
                </h1>

                <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Notice a pothole, broken streetlight, or water leak? CivicTrack sends your report directly to the right municipal department and keeps you informed until the repair is complete.
                </p>

                {/* Primary & Secondary Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href={isSignedIn ? "/citizen/report" : "/sign-up"}
                    className="px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all text-center flex items-center justify-center gap-2 min-h-[48px] text-sm"
                  >
                    <span>Report an Issue</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/map"
                    className="px-8 py-3.5 bg-card text-foreground border border-border rounded-xl font-semibold hover:bg-secondary transition-all text-center flex items-center justify-center gap-2 shadow-xs min-h-[48px] text-sm"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Explore City Map</span>
                  </Link>
                </div>

                {/* Clear benefits row */}
                <div className="pt-6 border-t border-border flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Free for all residents</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Precise map location</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Photo proof on completion</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Signature Card */}
              <div className="lg:col-span-5 relative">
                <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 lg:p-10 shadow-2xl shadow-primary/20 text-white">
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/20 pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-semibold tracking-wider uppercase text-blue-100">
                          Active City Services
                        </span>
                      </div>
                      <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-semibold text-white">
                        Live Tracking
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
                        <p className="font-bold text-white text-sm mb-1">
                          Direct Department Dispatch
                        </p>
                        <p className="text-blue-100 leading-relaxed">
                          Reports are verified and routed straight to the responsible team — roads, sanitation, electricity, or water.
                        </p>
                      </div>

                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
                        <p className="font-bold text-white text-sm mb-1">
                          Clear Target Response Times
                        </p>
                        <p className="text-blue-100 leading-relaxed">
                          Every category has a target resolution timeframe so issues are addressed without unnecessary delays.
                        </p>
                      </div>
                    </div>

                    {/* Staff portal sign in quick links */}
                    <div className="pt-2 border-t border-white/20">
                      <p className="text-[11px] text-blue-200 mb-2 font-medium">
                        Are you municipal staff?
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Link
                          href="/admin/login"
                          className="py-2.5 px-3 bg-white text-blue-900 rounded-xl font-bold text-xs text-center hover:bg-blue-50 transition shadow-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Admin Portal</span>
                        </Link>
                        <Link
                          href="/officer/login"
                          className="py-2.5 px-3 bg-white/20 text-white border border-white/30 rounded-xl font-bold text-xs text-center hover:bg-white/30 transition flex items-center justify-center gap-1.5 min-h-[44px]"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Field Officer</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: HOW IT WORKS IN 3 SIMPLE STEPS */}
        <section className="py-20 bg-card">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                Simple 3-Step Process
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                How CivicTrack Works
              </h2>
              <p className="text-muted-foreground text-sm">
                From spotting an issue in your neighborhood to seeing it repaired.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Step 1 */}
              <div className="rounded-3xl border border-border bg-background/50 p-8 shadow-xs hover:shadow-md transition-all space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  <Camera className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Step 1</span>
                  <h3 className="text-lg font-bold text-foreground">
                    Take a Photo & Describe
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Choose the category (road, water, lights, trash) and attach photos showing what needs attention.
                </p>
              </div>

              {/* Step 2 */}
              <div className="rounded-3xl border border-border bg-background/50 p-8 shadow-xs hover:shadow-md transition-all space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Step 2</span>
                  <h3 className="text-lg font-bold text-foreground">
                    Pin the Exact Location
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Click on the interactive city map or use your device GPS so field teams know exactly where to go.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-3xl border border-border bg-background/50 p-8 shadow-xs hover:shadow-md transition-all space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Step 3</span>
                  <h3 className="text-lg font-bold text-foreground">
                    Follow the Repair
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get updates as municipal officers arrive on-site, perform the repair, and upload completion proof.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: MUNICIPAL ROLES OVERVIEW */}
        <section className="py-16 border-t border-border bg-background">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-border bg-card p-8 lg:p-12 shadow-xs">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <div className="space-y-3 lg:pr-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <h4 className="font-bold text-foreground">Citizen Portal</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Report local problems in a few taps and track progress until they are solved.
                  </p>
                  <Link
                    href="/citizen"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline min-h-[44px]"
                  >
                    <span>Open Citizen Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3 lg:px-6 pt-6 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h4 className="font-bold text-foreground">Municipal Administration</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Review incoming reports, assign field teams, manage staff, and track resolution times.
                  </p>
                  <Link
                    href="/admin/login"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline min-h-[44px]"
                  >
                    <span>Sign in as Administrator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3 lg:pl-6 pt-6 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <h4 className="font-bold text-foreground">Field Operations</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    View assigned tasks, navigate to incident locations, and upload photo proof upon completion.
                  </p>
                  <Link
                    href="/officer/login"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline min-h-[44px]"
                  >
                    <span>Sign in as Field Officer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8 text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} CivicTrack — Smart Civic Complaint Management System.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/citizen" className="hover:text-foreground">Citizen Portal</Link>
            <span>&bull;</span>
            <Link href="/admin/login" className="hover:text-foreground">Staff Login</Link>
            <span>&bull;</span>
            <Link href="/map" className="hover:text-foreground">City Map</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
