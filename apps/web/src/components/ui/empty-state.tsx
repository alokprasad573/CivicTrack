"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const ActionIcon = action?.icon;

  const actionClasses =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground border border-blue-600 shadow-hairline hover:bg-blue-700 transition-[background-color,transform] duration-150 active:scale-[0.98] min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div
      role="status"
      className="rounded-2xl border border-slate-200/90 bg-card p-8 sm:p-12 text-center space-y-4 shadow-hairline"
    >
      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-600 flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>
      {action && (
        <div className="pt-2">
          {action.href ? (
            <Link href={action.href} className={actionClasses}>
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className={actionClasses}>
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
              <span>{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
