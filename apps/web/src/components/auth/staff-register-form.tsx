"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Landmark,
  Lock,
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
} from "lucide-react";
import { UserRole, VerifyStaffInvitationResponse } from "@civictrack/contracts";
import { useToast } from "@/components/ui/toast-context";

interface StaffRegisterFormProps {
  portalType: "admin" | "officer";
}

export function StaffRegisterForm({ portalType }: StaffRegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const { toast } = useToast();
  const formId = useId();

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
      const res = await fetch(
        `/api/v1/staff/invitations/verify?token=${encodeURIComponent(tokenToVerify.trim())}`
      );
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setInvitationData(json.data);
        setActiveToken(tokenToVerify.trim());
      } else {
        setVerifyError(
          json.error?.message || "This invitation link is invalid, expired, or has already been used."
        );
      }
    } catch {
      setVerifyError(
        "Network error verifying your invitation. Please check your connection and try again."
      );
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
        toast.success(
          "Account Created",
          "Your staff credentials have been verified and your workspace is ready."
        );

        // Redirect to corresponding portal
        const targetPath = json.data?.user?.role === UserRole.ADMIN ? "/admin" : "/officer";
        router.push(targetPath);
        router.refresh();
      } else {
        setSubmitError(
          json.error?.message || "Failed to create account. Please check your invitation details."
        );
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

  const tokenInputId = `${formId}-token`;
  const nameInputId = `${formId}-name`;
  const passwordInputId = `${formId}-password`;
  const confirmPasswordInputId = `${formId}-confirm-password`;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 antialiased">
      <div className="w-full max-w-lg space-y-6">
        {/* Navigation header */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href={loginUrl}
            className="inline-flex min-h-[44px] items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {isOfficer ? "Officer" : "Admin"} Sign In</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center text-xs sm:text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors rounded-lg"
          >
            Public Portal &rarr;
          </Link>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-elevated space-y-6">
          {/* Header */}
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white border border-blue-700/20 flex items-center justify-center mx-auto">
              <Landmark className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{portalTitle}</h1>
            <p className="text-sm text-slate-600">{portalDesc}</p>
          </div>

          {/* STEP 1: Enter token manually if none provided or verification failed */}
          {(!invitationData || verifyError) && (
            <div className="space-y-4">
              {verifyError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Invalid or Expired Invitation</p>
                    <p className="mt-0.5 leading-relaxed">{verifyError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleManualTokenSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor={tokenInputId}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Invitation Token
                  </label>
                  <p className="text-xs text-slate-600">
                    Paste the single-use registration token provided by your municipality
                    administrator.
                  </p>
                  <div className="relative pt-1">
                    <KeyRound
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id={tokenInputId}
                      type="text"
                      required
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="e.g. 4f9b20c18d3..."
                      className="min-h-[44px] w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="min-h-[44px] w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm border border-blue-600 shadow-hairline transition-[background-color,transform] duration-150 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98]"
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
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Verified Municipal Invitation</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInvitationData(null);
                      setTokenInput("");
                    }}
                    className="min-h-[44px] px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 underline rounded-lg"
                  >
                    Change token
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-blue-200/60">
                  <div>
                    <span className="text-slate-600 block">Invited Email</span>
                    <span className="font-semibold text-slate-900 break-all">
                      {invitationData.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">Assigned Role</span>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {invitationData.role === UserRole.ADMIN ? "Administrator" : "Field Officer"}
                    </span>
                  </div>
                  {invitationData.department && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-600 block">Assigned Department</span>
                      <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                <div
                  role="alert"
                  className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor={nameInputId}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id={nameInputId}
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="min-h-[44px] w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor={passwordInputId}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Set Password
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
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
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

                  {/* Password Checklist */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasLength ? "text-emerald-700 font-medium" : ""
                      }`}
                    >
                      {hasLength ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />
                      )}
                      <span>8+ characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasUpper ? "text-emerald-700 font-medium" : ""
                      }`}
                    >
                      {hasUpper ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />
                      )}
                      <span>Uppercase letter</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasLower ? "text-emerald-700 font-medium" : ""
                      }`}
                    >
                      {hasLower ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />
                      )}
                      <span>Lowercase letter</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasNumber && hasSpecial ? "text-emerald-700 font-medium" : ""
                      }`}
                    >
                      {hasNumber && hasSpecial ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1 shrink-0" />
                      )}
                      <span>Number &amp; symbol</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor={confirmPasswordInputId}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id={confirmPasswordInputId}
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="min-h-[44px] w-full bg-white border border-slate-200 rounded-xl pl-10 pr-12 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={
                        showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                      }
                      aria-pressed={showConfirmPassword}
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-rose-700 font-medium">Passwords do not match.</p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !isPasswordValid || !passwordsMatch}
                  className="min-h-[44px] w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm border border-blue-600 shadow-hairline transition-[background-color,transform] duration-150 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account &amp; Setting Session...</span>
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
        <p className="text-center text-xs text-slate-600">
          CivicTrack &middot; Department Municipal Administrative Services
        </p>
      </div>
    </div>
  );
}
