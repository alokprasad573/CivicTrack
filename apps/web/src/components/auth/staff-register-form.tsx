"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Shield,
  Lock,
  Mail,
  User,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Check,
  X,
} from "lucide-react";
import { UserRole, VerifyStaffInvitationResponse, STRONG_PASSWORD_REGEX } from "@civictrack/contracts";
import { useToast } from "@/components/ui/toast-context";

interface StaffRegisterFormProps {
  portalType: "admin" | "officer";
}

export function StaffRegisterForm({ portalType }: StaffRegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const { toast } = useToast();

  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<VerifyStaffInvitationResponse | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live password validation rules
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&#^()_+\-=\[\]{}|;:,.<>]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;

  // Verify invitation token
  const verifyToken = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;

    setIsVerifying(true);
    setVerifyError(null);
    setInvitationData(null);

    try {
      const res = await fetch(`/api/v1/staff/invitations/verify?token=${encodeURIComponent(tokenToVerify.trim())}`);
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setInvitationData(json.data);
        setActiveToken(tokenToVerify.trim());
      } else {
        setVerifyError(json.error?.message || "This invitation link is invalid, expired, or has already been used.");
      }
    } catch {
      setVerifyError("Network error verifying your invitation. Please check your connection and try again.");
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    if (initialToken) {
      verifyToken(initialToken);
    }
  }, [initialToken, verifyToken]);

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setVerifyError("Please enter your invitation token.");
      return;
    }
    verifyToken(tokenInput);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isPasswordValid) {
      setSubmitError("Please ensure your password meets all security criteria.");
      return;
    }

    if (!passwordsMatch) {
      setSubmitError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/v1/staff/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: activeToken,
          name: name.trim(),
          password,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        toast.success("Account Created", "Your staff credentials have been verified and your workspace is ready.");

        // Redirect to corresponding portal
        const targetPath = json.data?.user?.role === UserRole.ADMIN ? "/admin" : "/officer";
        router.push(targetPath);
        router.refresh();
      } else {
        setSubmitError(json.error?.message || "Failed to create account. Please check your invitation details.");
      }
    } catch {
      setSubmitError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOfficer = portalType === "officer";
  const loginUrl = isOfficer ? "/officer/login" : "/admin/login";
  const portalTitle = isOfficer ? "Field Officer Registration" : "Administrator Registration";
  const portalDesc = isOfficer
    ? "Complete your departmental onboarding using your verified municipal invitation."
    : "Complete your administrative onboarding using your verified municipal invitation.";

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12 antialiased">
      <div className="w-full max-w-lg space-y-6">
        {/* Navigation header */}
        <div className="flex items-center justify-between">
          <Link
            href={loginUrl}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {isOfficer ? "Officer" : "Admin"} Sign In</span>
          </Link>
          <Link href="/" className="text-xs text-blue-600 font-semibold hover:underline">
            Public Portal &rarr;
          </Link>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-2xl shadow-blue-500/5 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
              {isOfficer ? <Shield className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{portalTitle}</h1>
            <p className="text-xs text-slate-500">{portalDesc}</p>
          </div>

          {/* STEP 1: Enter token manually if none provided or verification failed */}
          {(!invitationData || verifyError) && (
            <div className="space-y-4">
              {verifyError && (
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Invalid or Expired Invitation</p>
                    <p className="mt-0.5">{verifyError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleManualTokenSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Invitation Token</label>
                  <p className="text-xs text-slate-400">
                    Paste the single-use registration token provided by your municipality administrator.
                  </p>
                  <div className="relative mt-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="e.g. 4f9b20c18d3..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98]"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Invitation...</span>
                    </>
                  ) : (
                    <span>Verify Invitation &rarr;</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Token Verified - Display invitation details and account creation form */}
          {invitationData && (
            <div className="space-y-6">
              {/* Verified Invite Details Card */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Verified Municipal Invitation</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInvitationData(null);
                      setTokenInput("");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Change token
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-blue-100/60">
                  <div>
                    <span className="text-slate-500 block">Invited Email</span>
                    <span className="font-semibold text-slate-800 break-all">{invitationData.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Assigned Role</span>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {invitationData.role === UserRole.ADMIN ? "Administrator" : "Field Officer"}
                    </span>
                  </div>
                  {invitationData.department && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block">Assigned Department</span>
                      <div className="inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {invitationData.department.name} ({invitationData.department.code})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Error */}
              {submitError && (
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Set Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
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

                  {/* Password Checklist */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px] text-slate-500">
                    <div className={`flex items-center gap-1 ${hasLength ? "text-emerald-600 font-medium" : ""}`}>
                      {hasLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 h-3 text-slate-300">&bull;</span>}
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center gap-1 ${hasUpper ? "text-emerald-600 font-medium" : ""}`}>
                      {hasUpper ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 h-3 text-slate-300">&bull;</span>}
                      <span>Uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1 ${hasLower ? "text-emerald-600 font-medium" : ""}`}>
                      {hasLower ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 h-3 text-slate-300">&bull;</span>}
                      <span>Lowercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1 ${hasNumber && hasSpecial ? "text-emerald-600 font-medium" : ""}`}>
                      {hasNumber && hasSpecial ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 h-3 text-slate-300">&bull;</span>}
                      <span>Number & symbol</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
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
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-[11px] text-rose-600 font-medium">Passwords do not match.</p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !isPasswordValid || !passwordsMatch}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 mt-4 disabled:opacity-60 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account & Setting Session...</span>
                    </>
                  ) : (
                    <span>Complete Registration &rarr;</span>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          CivicTrack &bull; Department Municipal Administrative Services
        </p>
      </div>
    </div>
  );
}
