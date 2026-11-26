import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { ArrowLeft, Landmark } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 antialiased">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <Link
            href="/map?from=%2Fsign-up"
            className="inline-flex min-h-[44px] items-center text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors rounded-lg"
          >
            Explore City Map &rarr;
          </Link>
        </div>

        <div className="text-center space-y-2.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white border border-blue-700/20 flex items-center justify-center mx-auto">
            <Landmark className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create a citizen account
          </h1>
          <p className="text-sm text-slate-600">
            Report local issues and track municipal resolutions
          </p>
        </div>

        <div className="flex justify-center">
          <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/citizen" />
        </div>
      </div>
    </div>
  );
}
