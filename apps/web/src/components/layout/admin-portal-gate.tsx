"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "./admin-shell";

export default function AdminPortalGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/register")) {
    return <>{children}</>;
  }
  return <AdminShell>{children}</AdminShell>;
}