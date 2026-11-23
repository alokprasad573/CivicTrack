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
  Bell,
} from "lucide-react";
import { NotificationBell } from "../notifications/notification-bell";

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
      <header className="sticky top-0 z-40 backdrop-blur-md bg-card/90 border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Mobile Trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/citizen" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-foreground">
                    CivicTrack
                  </span>
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                    Citizen
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5" aria-label="Citizen portal navigation">
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
                  href={nav.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[44px] ${
                    isActive
                      ? "bg-secondary text-primary font-bold shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "opacity-70"}`} />
                  <span>{nav.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Header User Controls */}
          <div className="flex items-center gap-2.5">
            <NotificationBell role="citizen" />

            {isLoaded && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-border">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-8 w-8 ring-1 ring-border bg-blue-600 text-white [&_*]:text-white [&_svg]:fill-white",
                      userButtonTrigger: "rounded-full bg-blue-600 text-white",
                    },
                  }}
                />
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-foreground leading-tight truncate max-w-[120px]">
                    {user?.fullName || user?.firstName || "Resident"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Citizen Portal
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-card p-4 space-y-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase px-2 mb-2">
              Menu Navigation
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
                  href={nav.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition min-h-[48px] ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{nav.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
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

      {/* Mobile Bottom Navigation Bar (48px+ touch targets) */}
      <nav
        aria-label="Mobile navigation bar"
        className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border lg:hidden px-2 py-1 shadow-lg"
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
                href={nav.href}
                className={`flex flex-col items-center justify-center py-2 rounded-xl text-[10px] font-semibold transition min-h-[48px] ${
                  isActive
                    ? "text-primary font-bold bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-75"}`} />
                <span className="mt-1 truncate max-w-[70px] text-center">{nav.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Footer */}
      <footer className="border-t border-border bg-card/50 py-5 text-xs text-muted-foreground mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>© {new Date().getFullYear()} CivicTrack &bull; Smart City Civic Issue Resolution Platform</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Fast Reporting</span>
            <span>&bull;</span>
            <span>Live Location Pinning</span>
            <span>&bull;</span>
            <span>Transparent Tracking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
