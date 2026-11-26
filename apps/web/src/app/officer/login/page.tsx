"use client";

import React, { useState, useId, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, Lock, Mail, Loader2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";

function OfficerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/officer";
  const formId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/officer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        const target = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/officer";
        router.push(target);
        router.refresh();
      } else {
        setError(json.error?.message || "Invalid departmental officer email or password.");
      }
    } catch {
      setError("Network error connecting to departmental auth service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const emailInputId = `${formId}-email`;
  const passwordInputId = `${formId}-password`;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 antialiased">
      <div className="w-full max-w-md space-y-6">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Public Portal</span>
          </Link>
          <Link
            href="/admin/login"
            className="inline-flex min-h-[44px] items-center text-xs sm:text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors rounded-lg"
          >
            Admin Portal Sign In &rarr;
          </Link>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-elevated space-y-6">
          {/* Header */}
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white border border-blue-700/20 flex items-center justify-center mx-auto">
              <Landmark className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Field Officer Portal
            </h1>
            <p className="text-sm text-slate-600">
              Sign in to access your assigned municipal work queue and resolution actions.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor={emailInputId}
                className="block text-xs font-medium text-slate-700"
              >
                Officer Email
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id={emailInputId}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="enter email"
                  className="min-h-[44px] w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={passwordInputId}
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id={passwordInputId}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="min-h-[44px] w-full bg-white border border-slate-200 rounded-xl pl-10 pr-12 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm border border-blue-600 shadow-hairline transition-[background-color,transform] duration-150 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? "Verifying Credentials..." : "Login"}</span>
            </button>
          </form>

          {/* Onboarding Register Link */}
          <div className="pt-4 border-t border-slate-200/80 text-center">
            <Link
              href="/officer/register"
              className="min-h-[44px] px-3 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center justify-center gap-1.5 rounded-lg"
            >
              <span>Create an account &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-600">
          CivicTrack &middot; Department Municipal Administrative Services
        </p>
      </div>
    </div>
  );
}

export default function OfficerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        </div>
      }
    >
      <OfficerLoginForm />
    </Suspense>
  );
}
