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
  Filter,
} from "lucide-react";
import { CitizenShell } from "../../components/layout/citizen-shell";
import { useNotifications } from "../../hooks/use-notifications";
import { NotificationType, INotification } from "@civictrack/contracts";

function getNotificationBadge(type: NotificationType) {
  switch (type) {
    case NotificationType.COMPLAINT_CREATED:
      return {
        icon: <FileText className="w-4 h-4 text-teal-400" />,
        bg: "bg-teal-500/10 text-teal-400 border-teal-500/20",
        label: "Registered",
      };
    case NotificationType.COMPLAINT_UNDER_REVIEW:
      return {
        icon: <Eye className="w-4 h-4 text-amber-400" />,
        bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        label: "Under Review",
      };
    case NotificationType.COMPLAINT_VERIFIED:
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        label: "Verified",
      };
    case NotificationType.COMPLAINT_REJECTED:
      return {
        icon: <AlertOctagon className="w-4 h-4 text-rose-400" />,
        bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        label: "Rejected",
      };
    case NotificationType.COMPLAINT_ASSIGNED:
      return {
        icon: <UserCheck className="w-4 h-4 text-cyan-400" />,
        bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        label: "Assigned",
      };
    case NotificationType.COMPLAINT_IN_PROGRESS:
      return {
        icon: <Wrench className="w-4 h-4 text-blue-400" />,
        bg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: "In Progress",
      };
    case NotificationType.COMPLAINT_RESOLVED:
      return {
        icon: <CheckCircle className="w-4 h-4 text-teal-400" />,
        bg: "bg-teal-500/10 text-teal-400 border-teal-500/20",
        label: "Resolved",
      };
    case NotificationType.COMPLAINT_CLOSED:
      return {
        icon: <Award className="w-4 h-4 text-teal-300" />,
        bg: "bg-teal-500/10 text-teal-300 border-teal-500/20",
        label: "Closed",
      };
    default:
      return {
        icon: <Bell className="w-4 h-4 text-muted-foreground" />,
        bg: "bg-secondary text-muted-foreground border-border",
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Notification Center
              </h1>
              {unreadCount > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Real-time alerts, incident dispatch updates, and municipal workflow transitions
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Status indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-mono text-muted-foreground"
              title={isConnected ? "Socket.io real-time connection active" : "Connecting..."}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span className="text-[11px] font-semibold text-foreground">
                {isConnected ? "Live Socket" : "Offline"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => refresh()}
              className="p-2 text-muted-foreground hover:text-foreground bg-card hover:bg-secondary/60 border border-border rounded-lg transition-colors"
              title="Refresh notifications"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterUnread(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !filterUnread
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterUnread(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterUnread
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* List of Notifications */}
        <div className="space-y-2.5">
          {isLoading && notifications.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading notification stream...</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                <Bell className="w-6 h-6 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No notifications found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {filterUnread
                  ? "You have caught up with all your unread notifications."
                  : "You will receive real-time notifications here as your filed complaints are verified, assigned, and resolved."}
              </p>
            </div>
          ) : (
            displayedNotifications.map((notif) => {
              const badge = getNotificationBadge(notif.type);
              const isUnread = !notif.readAt;

              return (
                <div
                  key={notif._id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isUnread
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "bg-card border-border hover:border-border/80 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-lg bg-secondary/80 shrink-0 mt-0.5">
                      {badge.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <h4
                          className={`text-xs sm:text-sm font-semibold ${
                            isUnread ? "text-foreground" : "text-foreground/90"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatFullTime(notif.createdAt)}</span>
                        {notif.resourceId && (
                          <>
                            <span className="mx-1">•</span>
                            <span className="text-foreground/80 font-medium">
                              Ref: {notif.resourceId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notif._id)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-colors"
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
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1 shadow-sm"
                      >
                        <span>View Complaint</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </CitizenShell>
  );
}
