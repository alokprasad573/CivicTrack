"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@civictrack/contracts";
import {
  CheckCircle2,
  Navigation,
  Landmark,
  LogOut,
  MapPin,
  Menu,
  X,
  Wrench,
} from "lucide-react";
import { NotificationBell } from "../notifications/notification-bell";
import { StaffAuthProvider, useStaffAuth } from "../../context/staff-auth-context";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const OFFICER_NAV: NavItem[] = [
  { id: "MY_WORK", label: "My Tasks", href: "/officer", icon: CheckCircle2 },
  { id: "FIELD_MAP", label: "Field Map", href: "/map", icon: Navigation },
];

function OfficerShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useStaffAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased pb-20 lg:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-card/90 border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <Link href="/officer" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-foreground">
                    CivicTrack
                  </span>
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                    Field Officer
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Field officer navigation">
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[44px] ${
                    isActive
                      ? "bg-secondary text-primary font-bold border border-border shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{nav.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            <NotificationBell role="officer" />

            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : "O"}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-semibold text-foreground truncate max-w-[120px]">
                  {user?.name || "Field Officer"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {user?.department?.name || "Field Operations"}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of Officer Portal"
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (Large 48px+ touch targets for field use) */}
      <nav
        aria-label="Mobile field navigation bar"
        className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border md:hidden px-3 py-1.5 shadow-lg"
      >
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
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
                className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold transition min-h-[48px] ${
                  isActive
                    ? "text-primary font-bold bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-75"}`} />
                <span className="mt-1">{nav.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive transition min-h-[48px]"
          >
            <LogOut className="w-5 h-5 opacity-75" />
            <span className="mt-1">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Desktop Footer */}
      <footer className="border-t border-border bg-card/50 py-4 text-xs text-muted-foreground mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© {new Date().getFullYear()} CivicTrack &bull; Smart City Civic Issue Resolution Platform</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>GPS Navigation</span>
            <span>&bull;</span>
            <span>Photo Proof Upload</span>
            <span>&bull;</span>
            <span>Status Updates</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function OfficerShell({ children }: { children: React.ReactNode }) {
  return (
    <StaffAuthProvider role={UserRole.OFFICER}>
      <OfficerShellContent>{children}</OfficerShellContent>
    </StaffAuthProvider>
  );
}
