"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCircle,
  CheckCircle2,
  AlertOctagon,
  Eye,
  FileText,
  UserCheck,
  Wrench,
  Award,
  ArrowRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import { CitizenShell } from "../../components/layout/citizen-shell";
import { PageHeader } from "../../components/ui/page-header";
import { EmptyState } from "../../components/ui/empty-state";
import { useNotifications } from "../../hooks/use-notifications";
import { NotificationType } from "@civictrack/contracts";

function getNotificationBadge(type: NotificationType) {
  switch (type) {
    case NotificationType.COMPLAINT_CREATED:
      return {
        icon: <FileText className="w-4 h-4 text-blue-600" />,
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        label: "Registered",
      };
    case NotificationType.COMPLAINT_UNDER_REVIEW:
      return {
        icon: <Eye className="w-4 h-4 text-amber-700" />,
        bg: "bg-amber-50 text-amber-800 border-amber-200",
        label: "Under Review",
      };
    case NotificationType.COMPLAINT_VERIFIED:
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        label: "Verified",
      };
    case NotificationType.COMPLAINT_REJECTED:
      return {
        icon: <AlertOctagon className="w-4 h-4 text-rose-600" />,
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        label: "Rejected",
      };
    case NotificationType.COMPLAINT_ASSIGNED:
      return {
        icon: <UserCheck className="w-4 h-4 text-sky-700" />,
        bg: "bg-sky-50 text-sky-800 border-sky-200",
        label: "Assigned",
      };
    case NotificationType.COMPLAINT_IN_PROGRESS:
      return {
        icon: <Wrench className="w-4 h-4 text-teal-700" />,
        bg: "bg-teal-50 text-teal-800 border-teal-200",
        label: "In Progress",
      };
    case NotificationType.COMPLAINT_RESOLVED:
      return {
        icon: <CheckCircle className="w-4 h-4 text-emerald-700" />,
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        label: "Resolved",
      };
    case NotificationType.COMPLAINT_CLOSED:
      return {
        icon: <Award className="w-4 h-4 text-slate-600" />,
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        label: "Closed",
      };
    default:
      return {
        icon: <Bell className="w-4 h-4 text-slate-600" />,
        bg: "bg-slate-100 text-slate-700 border-slate-200",
        label: "Notice",
      };
  }
}

function formatFullTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export default function NotificationsPage() {
  const [filterUnread, setFilterUnread] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications();

  const displayedNotifications = filterUnread
    ? notifications.filter((n) => !n.readAt)
    : notifications;

  return (
    <CitizenShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Notification Center"
          subtitle="Real-time alerts, incident dispatch updates, and municipal workflow transitions"
          badge={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        />

        {/* Toolbar: Filter Tabs & Stream Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 self-start"
            role="tablist"
            aria-label="Filter notifications"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!filterUnread}
              onClick={() => setFilterUnread(false)}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                !filterUnread
                  ? "bg-white text-slate-900 shadow-hairline border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 border border-transparent"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterUnread}
              onClick={() => setFilterUnread(true)}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                filterUnread
                  ? "bg-white text-slate-900 shadow-hairline border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 border border-transparent"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Connection status */}
            <div
              className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-700 shadow-hairline"
              title={isConnected ? "Socket.io real-time connection active" : "Connecting..."}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-600" : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              <span className="font-medium">
                {isConnected ? "Live Socket" : "Offline"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => refresh()}
              aria-label="Refresh notifications"
              title="Refresh notifications"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200/90 shadow-hairline transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 text-blue-700 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* List of Notifications */}
        <div className="space-y-3">
          {isLoading && notifications.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200/90 rounded-2xl shadow-hairline space-y-2.5">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-600">Loading notification stream...</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications found"
              description={
                filterUnread
                  ? "You have caught up with all your unread notifications."
                  : "You will receive real-time notifications here as your filed complaints are verified, assigned, and resolved."
              }
              action={
                filterUnread
                  ? {
                      label: "Show all notifications",
                      onClick: () => setFilterUnread(false),
                    }
                  : undefined
              }
            />
          ) : (
            displayedNotifications.map((notif) => {
              const badge = getNotificationBadge(notif.type);
              const isUnread = !notif.readAt;

              return (
                <article
                  key={notif._id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-hairline ${
                    isUnread
                      ? "bg-blue-50/50 border-blue-200/80"
                      : "bg-white border-slate-200/90 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200/80 shrink-0 mt-0.5">
                      {badge.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <h2 className="text-sm font-semibold text-slate-900">
                          {notif.title}
                        </h2>
                        {isUnread && (
                          <span
                            className="w-2 h-2 rounded-full bg-blue-600 shrink-0"
                            title="Unread"
                            aria-label="Unread notification"
                          />
                        )}
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed mb-2">
                        {notif.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatFullTime(notif.createdAt)}</span>
                        </span>
                        {notif.resourceId && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              &middot;
                            </span>
                            <span className="font-mono text-xs font-medium text-slate-700">
                              Ref: {notif.resourceId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 sm:self-center pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/80">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notif._id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-hairline transition-colors"
                      >
                        Mark read
                      </button>
                    )}

                    {notif.resourceType === "COMPLAINT" && (
                      <Link
                        href={`/citizen/complaints/${notif.resourceId}`}
                        onClick={() => {
                          if (isUnread) markAsRead(notif._id);
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 shadow-hairline transition-[background-color,transform] duration-150 active:scale-[0.98] inline-flex items-center gap-1.5"
                      >
                        <span>View Complaint</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </CitizenShell>
  );
}
