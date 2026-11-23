"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@civictrack/contracts";
import {
  Inbox,
  BarChart3,
  Building2,
  Users,
  MapPin,
  Menu,
  X,
  Landmark,
  LogOut,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { NotificationBell } from "../notifications/notification-bell";
import { StaffAuthProvider, useStaffAuth } from "../../context/staff-auth-context";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const ADMIN_NAV: NavItem[] = [
  { id: "ADMIN_OVERVIEW", label: "Review & Assign", href: "/admin", icon: Inbox },
  { id: "ANALYTICS", label: "Target Times & Reports", href: "/admin/analytics", icon: BarChart3 },
  { id: "DEPARTMENTS", label: "Departments", href: "/admin/departments", icon: Building2 },
  { id: "OFFICERS", label: "Field Staff Roster", href: "/admin/officers", icon: Users },
  { id: "CITY_MAP", label: "City Map", href: "/map", icon: MapPin },
];

function AdminShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useStaffAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased pb-16 lg:pb-0">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300 sticky top-0 h-screen z-30 shrink-0 ${
          sidebarCollapsed ? "w-18" : "w-64"
        }`}
        aria-label="Staff administration sidebar"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/admin" className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="font-bold text-base tracking-tight text-foreground block truncate">
                  CivicTrack
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  Operations Hub
                </span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Staff navigation">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer User & Controls */}
        <div className="p-3 border-t border-border space-y-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="truncate text-left text-xs">
                  <div className="font-semibold text-foreground truncate">{user?.name || "Administrator"}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user?.email || "Staff Admin"}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of Admin Portal"
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-card/90 border-b border-border h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-foreground">
                  City Operations Hub
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                  ADMIN
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell role="admin" />

            <div className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-border">
              <div className="text-right text-xs">
                <div className="font-semibold text-foreground truncate max-w-[130px]">
                  {user?.name || "Administrator"}
                </div>
                <div className="text-[10px] font-semibold text-primary">
                  ADMIN
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of Municipal Admin Portal"
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Drawer Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden absolute top-16 left-0 right-0 border-b border-border bg-card p-4 space-y-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase px-2 mb-2">
                Operations Navigation
              </p>
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition min-h-[48px] ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}

              <div className="pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 rounded-xl transition min-h-[48px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (48px+ touch targets) */}
      <nav
        aria-label="Mobile staff navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border lg:hidden px-2 py-1 shadow-lg"
      >
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {ADMIN_NAV.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 rounded-xl text-[10px] font-semibold transition min-h-[48px] ${
                  isActive
                    ? "text-primary font-bold bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "opacity-75"}`} />
                <span className="mt-1 truncate max-w-[70px] text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <StaffAuthProvider role={UserRole.ADMIN}>
      <AdminShellContent>{children}</AdminShellContent>
    </StaffAuthProvider>
  );
}
