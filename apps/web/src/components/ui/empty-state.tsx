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

  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 sm:p-14 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {action && (
        <div className="pt-2">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition min-h-[44px] min-w-[44px]"
            >
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition min-h-[44px] min-w-[44px]"
            >
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
              <span>{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
