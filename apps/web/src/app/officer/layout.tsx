"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { OfficerShell } from "../../components/layout/officer-shell";

export default function OfficerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // If on login or registration screen, render directly without the authenticated OfficerShell chrome
  if (pathname.startsWith("/officer/login") || pathname.startsWith("/officer/register")) {
    return <>{children}</>;
  }

  return <OfficerShell>{children}</OfficerShell>;
}
