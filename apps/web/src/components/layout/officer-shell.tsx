"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  CheckCircle2,
  Navigation,
  Menu,
  X,
  Shield,
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

const OFFICER_NAV: NavItem[] = [
  { id: "MY_WORK", label: "Assigned Work Queue", href: "/officer", icon: CheckCircle2 },
  { id: "FIELD_MAP", label: "Navigation & Field Map", href: "/map", icon: Navigation },
];


export function OfficerShell({ children }: { children: React.ReactNode }) {
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

            <Link href="/officer" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-[#d95d39] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg tracking-tight text-foreground">
                    CivicTrack
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30 font-semibold">
                    Field Officer
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  Department Field Investigation & Resolution Workspace
                </p>
              </div>
            </Link>
          </div>

          {/* Interactive Role Switcher Pills */}
          <PersonaPills activePersona="OFFICER" />

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            <NotificationBell role="officer" />

            {isLoaded && (
              <div className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-border">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-8 h-8 rounded-lg ring-1 ring-border",
                    },
                  }}
                />
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[140px]">
                    {user?.fullName || "Field Officer"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono font-medium truncate max-w-[140px]">
                    OFFICER &bull; FIELD OPS
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sub-navigation Bar for Officer */}
        <div className="border-t border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2">
            {OFFICER_NAV.map((nav) => {
              const Icon = nav.icon;
              const isActive =
                nav.href === "/officer"
                  ? pathname === "/officer"
                  : pathname.startsWith(nav.href);

              return (
                <Link
                  key={nav.id}
                  href={nav.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#d95d39] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{nav.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-card p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-mono text-muted-foreground uppercase px-2 mb-1">
                Field Officer Navigation
              </p>
              {OFFICER_NAV.map((nav) => {
                const Icon = nav.icon;
                const isActive =
                  nav.href === "/officer"
                    ? pathname === "/officer"
                    : pathname.startsWith(nav.href);

                return (
                  <Link
                    key={nav.id}
                    href={nav.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#d95d39] text-white"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{nav.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border space-y-1">
              <p className="text-[11px] font-mono text-muted-foreground uppercase px-2 mb-1">
                Switch Perspective
              </p>
              <PersonaPills activePersona="OFFICER" mobile onItemClick={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 py-4 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© {new Date().getFullYear()} CivicTrack Municipal Field Operations. GPS Geolocation & S3 Resolution Proof Enabled.</p>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Turn-by-Turn Navigation Ready
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
