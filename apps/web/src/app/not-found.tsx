import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-10 text-center shadow-elevated space-y-5">
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-700 flex items-center justify-center mx-auto">
          <Compass className="w-5 h-5" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200/80 tabular-nums">
            404
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            The requested civic portal page or complaint record could not be found or has moved.
          </p>
        </div>

        <div className="pt-1">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm border border-blue-600 shadow-hairline transition-[background-color,transform] duration-150 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to CivicTrack Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
