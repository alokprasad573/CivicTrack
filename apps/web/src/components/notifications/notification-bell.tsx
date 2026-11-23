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
      return <FileText className="w-4 h-4 text-teal-400" />;
    case NotificationType.COMPLAINT_UNDER_REVIEW:
      return <Eye className="w-4 h-4 text-amber-400" />;
    case NotificationType.COMPLAINT_VERIFIED:
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case NotificationType.COMPLAINT_REJECTED:
      return <AlertOctagon className="w-4 h-4 text-rose-400" />;
    case NotificationType.COMPLAINT_ASSIGNED:
      return <UserCheck className="w-4 h-4 text-cyan-400" />;
    case NotificationType.COMPLAINT_IN_PROGRESS:
      return <Wrench className="w-4 h-4 text-blue-400" />;
    case NotificationType.COMPLAINT_RESOLVED:
      return <CheckCircle className="w-4 h-4 text-teal-400" />;
    case NotificationType.COMPLAINT_CLOSED:
      return <Award className="w-4 h-4 text-teal-300" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
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

  const handleNotificationClick = async (notif: INotification) => {
    if (!notif.readAt) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);

    // Target route formulation
    if (notif.resourceType === "COMPLAINT") {
      if (role === "admin") {
        router.push(`/admin/complaints/${notif.resourceId}`);
      } else if (role === "officer") {
        router.push(`/officer/complaints/${notif.resourceId}`);
      } else {
        router.push(`/citizen/complaints/${notif.resourceId}`);
      }
    } else {
      router.push("/notifications");
    }
  };

  const getComplaintUrl = (notif: INotification) => {
    if (notif.resourceType === "COMPLAINT") {
      if (role === "admin") return `/admin/complaints/${notif.resourceId}`;
      if (role === "officer") return `/officer/complaints/${notif.resourceId}`;
      return `/citizen/complaints/${notif.resourceId}`;
    }
    return "/notifications";
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors relative"
        title="Notifications"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 ? (
          <>
            <span className="w-2 h-2 rounded-full bg-primary absolute top-1.5 right-1.5 animate-pulse" />
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full border border-background shadow-sm leading-tight">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </>
        ) : null}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border shadow-2xl rounded-xl z-50 overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Real-time connection indicator */}
              <div
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                title={isConnected ? "Real-time updates live" : "Connecting to real-time service..."}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className="hidden sm:inline text-[10px]">
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-[11px] text-primary hover:text-primary/80 font-medium hover:underline flex items-center gap-1 ml-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center mx-auto text-muted-foreground">
                  <Bell className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-foreground">No notifications yet</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Updates on your civic complaints, verified actions, and assignments will appear here in real-time.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors relative text-left ${
                      isUnread
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-secondary/80 shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread ? "font-semibold text-foreground" : "font-medium"
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] line-clamp-2 leading-relaxed opacity-90">
                        {notif.message}
                      </p>
                    </div>

                    {isUnread && (
                      <span
                        className="w-2 h-2 rounded-full bg-primary shrink-0 self-center"
                        title="Unread"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-card border-t border-border text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Floating Real-Time Toast Banner */}
      {toastNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-card/95 backdrop-blur-md border border-primary/40 shadow-2xl rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
            {getNotificationIcon(toastNotification.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                Live Update
              </span>
              <button
                type="button"
                onClick={dismissToast}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs font-semibold text-foreground mt-0.5">
              {toastNotification.title}
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
              {toastNotification.message}
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <Link
                href={getComplaintUrl(toastNotification)}
                onClick={dismissToast}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1 shadow-sm"
              >
                <span>View Details</span>
              </Link>
              <button
                type="button"
                onClick={dismissToast}
                className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
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
