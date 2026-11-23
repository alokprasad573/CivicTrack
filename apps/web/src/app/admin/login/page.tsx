"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, Lock, Mail, User, Loader2, AlertCircle, ArrowLeft, Eye, EyeOff, Check } from "lucide-react";

export function AdminAuthForm({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/admin";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  // Live password validation rules
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&#^()_+\-=\[\]{}|;:,.<>]/.test(password);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (isRegister) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Name is required");
        setIsLoading(false);
        return;
      }
      if (trimmedName.length > 120) {
        setError("Name cannot exceed 120 characters");
        setIsLoading(false);
        return;
      }
      if (!hasLength) {
        setError("Password must be at least 8 characters long");
        setIsLoading(false);
        return;
      }
      if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        setError("Password must include at least one uppercase letter, one lowercase letter, one number, and one special character");
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const endpoint = isRegister ? "/api/v1/admin/auth/register" : "/api/v1/admin/auth/login";
      const payload = isRegister
        ? { name: name.trim(), email: email.trim(), password, confirmPassword }
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        const target = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin";
        router.push(target);
        router.refresh();
      } else {
        setError(json.error?.message || (isRegister ? "Registration failed. Please check your details." : "Invalid administrator email or password."));
      }
    } catch {
      setError("Network error connecting to municipal auth service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setError(null);
    setName("");
    setMode(isRegister ? "login" : "register");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12 antialiased">
      <div className="w-full max-w-md space-y-6">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Portal</span>
          </Link>
          <Link
            href="/officer/login"
            className="text-xs text-blue-600 font-semibold hover:underline"
          >
            Field Officer Sign In &rarr;
          </Link>
        </div>

        {/* Card Box */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-2xl shadow-blue-500/5 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
                <Landmark className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Municipal Admin Portal
            </h1>
            <p className="text-xs text-slate-500">
              {isRegister
                ? "Create your municipal administrator account."
                : "Sign in with your verified municipal administrator credentials."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {isRegister ? "Work Email *" : "Email"}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isRegister ? "work email address" : "enter email"}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-slate-600">Password Requirements:</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-500">
                  <div className={`flex items-center gap-1.5 transition-colors ${hasLength ? "text-emerald-600 font-medium" : ""}`}>
                    {hasLength ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${hasUpper ? "text-emerald-600 font-medium" : ""}`}>
                    {hasUpper ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />}
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${hasLower ? "text-emerald-600 font-medium" : ""}`}>
                    {hasLower ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />}
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${hasNumber ? "text-emerald-600 font-medium" : ""}`}>
                    {hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />}
                    <span>One number</span>
                  </div>
                  <div className={`col-span-2 flex items-center gap-1.5 transition-colors ${hasSpecial ? "text-emerald-600 font-medium" : ""}`}>
                    {hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />}
                    <span>One special character (!@#$%^&*...)</span>
                  </div>
                </div>
              </div>
            )}

            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="confirm password"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] pt-1">
                    {password === confirmPassword ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-rose-500 flex items-center gap-1">
                        &bull; Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isRegister ? "Register" : "Login"}</span>
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1.5"
            >
              <span>{isRegister ? "Already have an account? Login" : "Create an account"}</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          CivicTrack &bull; Department Municipal Administrative Services
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AdminAuthForm initialMode="login" />
    </Suspense>
  );
}
