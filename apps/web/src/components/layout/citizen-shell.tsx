"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  MapPin,
  Menu,
  X,
  Landmark,
  ChevronRight,
} from "lucide-react";
import { NotificationBell } from "../notifications/notification-bell";
import { buildMapReturnHref } from "../../lib/map-navigation";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const CITIZEN_NAV: NavItem[] = [
  { id: "DASHBOARD", label: "Dashboard", href: "/citizen", icon: LayoutDashboard },
  { id: "REPORT", label: "Report an Issue", href: "/citizen/report", icon: PlusCircle },
  { id: "COMPLAINTS", label: "My Reports", href: "/citizen/complaints", icon: FileText },
  { id: "CITY_MAP", label: "City Map", href: "/map", icon: MapPin },
];

export function CitizenShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased pb-20 lg:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Mobile Trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/citizen" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white border border-blue-700/20 shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base sm:text-lg tracking-tight text-slate-900">
                  CivicTrack
                </span>
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                  Citizen
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Citizen portal navigation">
            {CITIZEN_NAV.map((nav) => {
              const Icon = nav.icon;
              const isActive =
                isHydrated &&
                (nav.href === "/citizen"
                  ? pathname === "/citizen"
                  : pathname.startsWith(nav.href));

              return (
                <Link
                  key={nav.id}
                  href={buildMapReturnHref(nav.href, isHydrated ? pathname : null)}
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

          {/* Right Header User Controls */}
          <div className="flex items-center gap-2">
            <NotificationBell role="citizen" />

            {isLoaded && (
              <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200/80">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-8 w-8 ring-1 ring-slate-200",
                      userButtonTrigger: "rounded-full",
                    },
                  }}
                />
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-slate-900 leading-tight truncate max-w-[140px]">
                    {user?.fullName || user?.firstName || "Resident"}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Citizen Portal
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 bg-white px-4 py-3 space-y-1 shadow-elevated animate-in fade-in slide-in-from-top-2 duration-150">
            <p className="text-xs font-medium text-slate-500 px-2 py-1">
              Navigation
            </p>
            {CITIZEN_NAV.map((nav) => {
              const Icon = nav.icon;
              const isActive =
                isHydrated &&
                (nav.href === "/citizen"
                  ? pathname === "/citizen"
                  : pathname.startsWith(nav.href));

              return (
                <Link
                  key={nav.id}
                  href={buildMapReturnHref(nav.href, isHydrated ? pathname : null)}
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
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation bar"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200/80 lg:hidden px-2 py-1.5"
      >
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {CITIZEN_NAV.map((nav) => {
            const Icon = nav.icon;
            const isActive =
              isHydrated &&
              (nav.href === "/citizen"
                ? pathname === "/citizen"
                : pathname.startsWith(nav.href));

            return (
              <Link
                key={nav.id}
                href={buildMapReturnHref(nav.href, isHydrated ? pathname : null)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] transition-colors min-h-[48px] ${
                  isActive
                    ? "bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/60"
                    : "text-slate-600 font-medium hover:text-slate-900 border border-transparent"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-500"}`} />
                <span className="mt-1 truncate max-w-[72px] text-center">{nav.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 py-5 text-xs text-slate-600 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>© {new Date().getFullYear()} CivicTrack · Municipal Civic Issue Resolution Platform</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>Issue reporting</span>
            <span aria-hidden="true">·</span>
            <span>Location pinning</span>
            <span aria-hidden="true">·</span>
            <span>Status tracking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
