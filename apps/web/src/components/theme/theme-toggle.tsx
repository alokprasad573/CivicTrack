"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-context";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-xl border border-border bg-card/60 flex items-center justify-center opacity-60 ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to Warm Sandstone Light Theme" : "Switch to Forest Charcoal Dark Theme"}
      aria-label="Toggle visual theme"
      className={`p-2 rounded-xl transition-all border border-border bg-card hover:bg-secondary/80 text-foreground shadow-sm flex items-center justify-center group ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-stone-700 group-hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
