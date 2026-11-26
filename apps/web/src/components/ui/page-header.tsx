"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  backHref?: string;
  backLabel?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ElementType;
    variant?: "primary" | "secondary";
  };
}

export function PageHeader({
  title,
  subtitle,
  badge,
  backHref,
  backLabel = "Back",
  action,
}: PageHeaderProps) {
  const ActionIcon = action?.icon;

  const actionClasses = `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-hairline transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    action?.variant === "secondary"
      ? "bg-card text-foreground border border-slate-200 hover:bg-slate-50"
      : "bg-primary text-primary-foreground border border-blue-600 hover:bg-blue-700"
  }`;

  return (
    <div className="space-y-2 pb-2">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors min-h-[44px] py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            {badge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div className="shrink-0 self-start sm:self-auto">
            {action.href ? (
              <Link href={action.href} className={actionClasses}>
                {ActionIcon && <ActionIcon className="w-4 h-4" />}
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className={actionClasses}
              >
                {ActionIcon && <ActionIcon className="w-4 h-4" />}
                <span>{action.label}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
