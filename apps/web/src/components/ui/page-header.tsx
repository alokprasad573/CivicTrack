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

  return (
    <div className="space-y-3 pb-2">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-[44px] py-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {badge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div className="shrink-0 self-start sm:self-auto">
            {action.href ? (
              <Link
                href={action.href}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition active:scale-[0.98] min-h-[44px] min-w-[44px] ${
                  action.variant === "secondary"
                    ? "bg-card text-foreground border border-border hover:bg-secondary"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                }`}
              >
                {ActionIcon && <ActionIcon className="w-4 h-4" />}
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition active:scale-[0.98] min-h-[44px] min-w-[44px] ${
                  action.variant === "secondary"
                    ? "bg-card text-foreground border border-border hover:bg-secondary"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                }`}
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
