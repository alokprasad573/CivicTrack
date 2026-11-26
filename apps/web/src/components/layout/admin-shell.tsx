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
  CircleUser,
} from "lucide-react";
import { NotificationBell } from "../notifications/notification-bell";
import { StaffAuthProvider, useStaffAuth } from "../../context/staff-auth-context";
import { buildMapReturnHref } from "../../lib/map-navigation";

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
  { id: "OFFICERS", label: "Officer Directory", href: "/admin/officers", icon: Users },
  { id: "CITY_MAP", label: "City Map", href: "/map", icon: MapPin },
];

function AdminShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useStaffAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased pb-20 lg:pb-0">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200 ease-apple sticky top-0 h-screen z-30 shrink-0 ${
          sidebarCollapsed ? "w-[72px]" : "w-64"
        }`}
        aria-label="Staff administration sidebar"
      >
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-slate-200/80 ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <Link
            href="/admin"
            className="flex items-center gap-3 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white border border-blue-700/20 shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="font-semibold text-base tracking-tight text-slate-900 block truncate">
                  CivicTrack
                </span>
                <span className="text-[11px] text-slate-600 block truncate">
                  Operations Hub
                </span>
              </div>
            )}
          </Link>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Staff navigation">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[44px] mb-1"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={buildMapReturnHref(item.href, pathname)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors duration-150 min-h-[44px] ${
                  isActive
                    ? "bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/60"
                    : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-blue-700" : "text-slate-500"
                  }`}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer User */}
        <div className="p-3 border-t border-slate-200/80">
          <div
            className={`flex items-center p-2 rounded-xl bg-slate-50 border border-slate-200/80 ${
              sidebarCollapsed ? "justify-center" : "gap-2.5"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 shrink-0">
              <CircleUser className="w-4 h-4" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate text-left text-xs min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {user?.name || "Administrator"}
                </div>
                <div className="text-[11px] text-slate-600 truncate">
                  {user?.email || "Staff Admin"}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6">
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

            <div className="flex items-center gap-2">
              <span className="font-semibold text-base sm:text-lg tracking-tight text-slate-900">
                City Operations Hub
              </span>
              <span className="hidden sm:inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell role="admin" />
            <div className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-slate-200/80">
              <div className="text-right text-xs">
                <div className="font-semibold text-slate-900 truncate max-w-[140px]">
                  {user?.name || "Administrator"}
                </div>
                <div className="text-[11px] text-slate-600">
                  Admin Portal
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of Municipal Admin Portal"
                aria-label="Sign out of Municipal Admin Portal"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Drawer Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden absolute top-16 left-0 right-0 border-b border-slate-200/80 bg-white p-4 space-y-1.5 shadow-elevated animate-in fade-in slide-in-from-top-2 duration-150">
              <p className="text-xs font-medium text-slate-500 px-2 py-1">
                Operations navigation
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
                    href={buildMapReturnHref(item.href, pathname)}
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
                      <span>{item.label}</span>
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

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile staff navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200/80 lg:hidden px-2 py-1.5"
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
                href={buildMapReturnHref(item.href, pathname)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] transition-colors min-h-[48px] ${
                  isActive
                    ? "bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/60"
                    : "text-slate-600 font-medium hover:text-slate-900 border border-transparent"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-500"}`} />
                <span className="mt-1 truncate max-w-[72px] text-center">{item.label}</span>
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
