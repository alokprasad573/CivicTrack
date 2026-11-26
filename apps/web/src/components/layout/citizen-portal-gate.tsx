"use client";

import React from "react";
import { CitizenShell } from "./citizen-shell";

export default function CitizenPortalGate({ children }: { children: React.ReactNode }) {
  return <CitizenShell>{children}</CitizenShell>;
}