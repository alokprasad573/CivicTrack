"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "../../components/layout/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // If on login or registration screen, render directly without the authenticated AdminShell chrome
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/register")) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
