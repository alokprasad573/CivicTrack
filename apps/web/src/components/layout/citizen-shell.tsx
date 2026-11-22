"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  Activity,
  Plus,
  FileText,
  MapPin,
  Menu,
  X,
  ShieldCheck,
  Bell,
  ChevronRight,
} from "lucide-react";
import { NotificationBell } from "../notifications/notification-bell";
import { ThemeToggle } from "../theme/theme-toggle";
import { PersonaPills } from "./persona-pills";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const CITIZEN_NAV: NavItem[] = [
  { id: "OVERVIEW", label: "Overview", href: "/citizen", icon: Activity },
  { id: "REPORT", label: "Report an Issue", href: "/citizen/report", icon: Plus },
  { id: "MY_COMPLAINTS", label: "My Complaints", href: "/citizen/complaints", icon: FileText },
  { id: "NEARBY", label: "Nearby Map", href: "/map", icon: MapPin },
];


export function CitizenShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Top Role Switcher & System Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-card/95 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-[#d95d39] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg tracking-tight text-foreground">
                    CivicTrack
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">
                    Citizen
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  Municipal Infrastructure & Resolution Portal
                </p>
              </div>
            </Link>
          </div>

          {/* Interactive Role Switcher Pills */}
          <PersonaPills activePersona="CITIZEN" />

          {/* Right Utility Controls: Theme Toggle + Socket Notifications + User */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            <NotificationBell role="citizen" />

            {isLoaded && (
              <div className="flex items-center gap-2.5 pl-2.5 border-l border-border">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-full border border-border shadow-sm",
                    },
                  }}
                />
                <div className="hidden lg:block text-left text-xs">
                  <div className="font-semibold text-foreground leading-tight truncate max-w-[130px]">
                    {user?.fullName || "Citizen"}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    ROLE: CITIZEN
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sub-Navigation Bar for Citizen */}
        <div className="border-t border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2">
            {CITIZEN_NAV.map((nav) => {
              const Icon = nav.icon;
              const isActive =
                nav.href === "/citizen"
                  ? pathname === "/citizen"
                  : pathname.startsWith(nav.href);

              return (
                <Link
                  key={nav.id}
                  href={nav.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-card text-[#d95d39] dark:text-[#f08c6e] border border-border shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#d95d39]" : "opacity-60"}`} />
                  <span>{nav.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-card px-4 pt-3 pb-4 space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase px-2">Role Portals</div>
            <PersonaPills activePersona="CITIZEN" mobile onItemClick={() => setMobileMenuOpen(false)} />

            <div className="text-[10px] font-mono text-muted-foreground uppercase px-2 pt-2 border-t border-border">Citizen Sections</div>
            {CITIZEN_NAV.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/citizen"
                  ? pathname === "/citizen"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#d95d39] text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/60 py-4 px-4 sm:px-6 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CivicTrack &bull; Smart Civic Complaint Management System</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            Sandstone & Terracotta Civic UI &bull; GeoJSON 2dsphere &bull; S3 Pre-Signed
          </span>
        </div>
      </footer>
    </div>
  );
}
