"use client";

import React, { Suspense } from "react";
import { AdminAuthForm } from "../login/page";
import { Loader2 } from "lucide-react";

export default function AdminRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        </div>
      }
    >
      <AdminAuthForm initialMode="register" />
    </Suspense>
  );
}
