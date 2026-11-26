"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-hairline transition-colors hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}