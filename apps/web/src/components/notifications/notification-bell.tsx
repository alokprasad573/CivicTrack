"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  X,
  ExternalLink,
} from "lucide-react";
import { useNotifications } from "../../hooks/use-notifications";
import { INotification, NotificationType } from "@civictrack/contracts";

interface NotificationBellProps {
  role?: "citizen" | "admin" | "officer";
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.COMPLAINT_CREATED:
      return <FileText className="w-4 h-4 text-blue-600" />;
    case NotificationType.COMPLAINT_UNDER_REVIEW:
      return <Eye className="w-4 h-4 text-amber-700" />;
    case NotificationType.COMPLAINT_VERIFIED:
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case NotificationType.COMPLAINT_REJECTED:
      return <AlertOctagon className="w-4 h-4 text-rose-600" />;
    case NotificationType.COMPLAINT_ASSIGNED:
      return <UserCheck className="w-4 h-4 text-sky-700" />;
    case NotificationType.COMPLAINT_IN_PROGRESS:
      return <Wrench className="w-4 h-4 text-teal-700" />;
    case NotificationType.COMPLAINT_RESOLVED:
      return <CheckCircle className="w-4 h-4 text-emerald-700" />;
    case NotificationType.COMPLAINT_CLOSED:
      return <Award className="w-4 h-4 text-slate-600" />;
    default:
      return <Bell className="w-4 h-4 text-slate-600" />;
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function NotificationBell({ role = "citizen" }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    toastNotification,
    dismissToast,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const getComplaintUrl = (notif: INotification) => {
    if (notif.resourceType === "COMPLAINT") {
      if (role === "admin") return `/admin/complaints/${notif.resourceId}`;
      if (role === "officer") return `/officer/complaints/${notif.resourceId}`;
      return `/citizen/complaints/${notif.resourceId}`;
    }
    return "/notifications";
  };

  const handleNotificationClick = async (notif: INotification) => {
    if (!notif.readAt) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);
    router.push(getComplaintUrl(notif));
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title="Notifications"
        aria-label={
          unreadCount > 0 ? `View notifications (${unreadCount} unread)` : "View notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-blue-600 text-white text-[11px] font-semibold rounded-full border-2 border-white leading-none tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200/90 shadow-elevated rounded-2xl z-50 overflow-hidden flex flex-col text-slate-900 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-medium tabular-nums">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Real-time connection indicator */}
              <div
                className="flex items-center gap-1.5 text-xs text-slate-600"
                title={isConnected ? "Real-time updates live" : "Connecting to real-time service"}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline text-[11px] font-medium">
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-blue-50/80 transition-colors min-h-[36px]"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-200/70">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-600 space-y-2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center mx-auto text-slate-500">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No notifications yet</p>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  Updates on your civic complaints, verified actions, and assignments will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <button
                    key={notif._id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full p-3.5 flex items-start gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                      isUnread
                        ? "bg-blue-50/50 hover:bg-blue-50/80 text-slate-900"
                        : "bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200/70 shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-800"
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {isUnread && (
                      <span
                        className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center"
                        title="Unread"
                        aria-label="Unread notification"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200/80 bg-slate-50/70 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="w-full min-h-[44px] px-4 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-slate-100/70 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Floating Real-Time Toast Banner */}
      {toastNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-elevated rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-200"
        >
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200/70 shrink-0 mt-0.5">
            {getNotificationIcon(toastNotification.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-blue-700">
                Live update
              </span>
              <button
                type="button"
                onClick={dismissToast}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 -mr-2 -mt-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">
              {toastNotification.title}
            </p>
            <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
              {toastNotification.message}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Link
                href={getComplaintUrl(toastNotification)}
                onClick={dismissToast}
                className="px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
              >
                <span>View details</span>
              </Link>
              <button
                type="button"
                onClick={dismissToast}
                className="px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
