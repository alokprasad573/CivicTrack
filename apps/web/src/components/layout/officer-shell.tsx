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
  Menu,
  X,
  ChevronRight,
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
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Mobile Trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/officer" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white border border-blue-700/20 shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base sm:text-lg tracking-tight text-slate-900">
                  CivicTrack
                </span>
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                  Field Officer
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Field officer navigation">
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
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition-colors duration-150 min-h-[44px] ${
                    isActive
                      ? "bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/60"
                      : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-700" : "text-slate-500"}`} />
                  <span>{nav.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <NotificationBell role="officer" />

            <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200/80">
              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : "O"}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-semibold text-slate-900 truncate max-w-[140px]">
                  {user?.name || "Field Officer"}
                </div>
                <div className="text-[11px] text-slate-600 truncate max-w-[140px]">
                  {user?.department?.name || "Field Operations"}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of Officer Portal"
                aria-label="Sign out of Officer Portal"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 bg-white px-4 py-3 space-y-1.5 shadow-elevated animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Field navigation</span>
              {user?.department?.name && (
                <span className="text-xs text-slate-600 truncate max-w-[180px]">
                  {user.department.name}
                </span>
              )}
            </div>
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
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] ${
                    isActive
                      ? "bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/60"
                      : "text-slate-700 font-medium hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-700" : "text-slate-500"}`} />
                    <span>{nav.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50 rounded-xl transition-colors min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile field navigation bar"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200/80 md:hidden px-3 py-1.5"
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
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] transition-colors min-h-[48px] ${
                  isActive
                    ? "bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/60"
                    : "text-slate-600 font-medium hover:text-slate-900 border border-transparent"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-500"}`} />
                <span className="mt-1">{nav.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-medium text-slate-600 hover:text-rose-700 transition-colors min-h-[48px]"
          >
            <LogOut className="w-5 h-5 text-slate-500" />
            <span className="mt-1">Sign out</span>
          </button>
        </div>
      </nav>

      {/* Desktop Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 py-4 text-xs text-slate-600 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© {new Date().getFullYear()} CivicTrack · Municipal Civic Issue Resolution Platform</p>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>GPS navigation</span>
            <span aria-hidden="true">·</span>
            <span>Photo evidence</span>
            <span aria-hidden="true">·</span>
            <span>Field updates</span>
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
