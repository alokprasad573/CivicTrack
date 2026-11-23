"use client";

import React, { createContext, useContext, useState, useCallback, useId } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  showToast: (toast: { type: ToastType; title: string; message?: string }) => void;
  toast: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message }: { type: ToastType; title: string; message?: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      // Auto-dismiss after 4.5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const toastHelpers = {
    success: (title: string, message?: string) => showToast({ type: "success", title, message }),
    error: (title: string, message?: string) => showToast({ type: "error", title, message }),
    info: (title: string, message?: string) => showToast({ type: "info", title, message }),
    warning: (title: string, message?: string) => showToast({ type: "warning", title, message }),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast: toastHelpers, removeToast }}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";
          const isWarning = t.type === "warning";

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                isSuccess
                  ? "bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-slate-100 shadow-emerald-500/10"
                  : isError
                  ? "bg-white/95 dark:bg-slate-900/95 border-rose-200 dark:border-rose-800 text-slate-900 dark:text-slate-100 shadow-rose-500/10"
                  : isWarning
                  ? "bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800 text-slate-900 dark:text-slate-100 shadow-amber-500/10"
                  : "bg-white/95 dark:bg-slate-900/95 border-blue-200 dark:border-blue-800 text-slate-900 dark:text-slate-100 shadow-blue-500/10"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                {isWarning && <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                {!isSuccess && !isError && !isWarning && (
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</p>
                {t.message && (
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{t.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
