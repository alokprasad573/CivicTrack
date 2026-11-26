"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { OfficerShell } from "./officer-shell";

export default function OfficerPortalGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/officer/login") || pathname.startsWith("/officer/register")) {
    return <>{children}</>;
  }
  return <OfficerShell>{children}</OfficerShell>;
}