"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export type PersonaId = "PUBLIC" | "CITIZEN" | "ADMIN" | "OFFICER";

interface PersonaPillItem {
  id: PersonaId;
  label: string;
  href: string;
}

export const PERSONA_PILLS: PersonaPillItem[] = [
  { id: "PUBLIC", label: "Public", href: "/" },
  { id: "CITIZEN", label: "Citizen Portal", href: "/citizen" },
  { id: "ADMIN", label: "Admin Console", href: "/admin" },
  { id: "OFFICER", label: "Officer Field", href: "/officer" },
];

export function PersonaPills({
  activePersona,
  mobile = false,
  onItemClick,
}: {
  activePersona: PersonaId;
  mobile?: boolean;
  onItemClick?: () => void;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<PersonaId | null>(null);

  const handleSelect = async (p: PersonaPillItem) => {
    if (onItemClick) onItemClick();
    if (p.id === activePersona && p.id !== "PUBLIC") return;

    setSwitching(p.id);

    if (p.id !== "PUBLIC") {
      try {
        await fetch("/api/v1/users/me/switch-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: p.id }),
        });
      } catch {
        // Fallback to client navigation if backend is unreachable
      }
    }

    router.push(p.href);
    router.refresh();
  };

  if (mobile) {
    return (
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {PERSONA_PILLS.map((p) => {
          const isSelected = p.id === activePersona;
          const isLoading = switching === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={isLoading}
              onClick={() => handleSelect(p)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold text-center border flex items-center justify-center gap-1.5 transition-all ${
                isSelected
                  ? "bg-[#d95d39] text-white border-transparent shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center rounded-xl p-1 gap-1 border border-border bg-secondary/50">
      {PERSONA_PILLS.map((p) => {
        const isSelected = p.id === activePersona;
        const isLoading = switching === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={isLoading}
            onClick={() => handleSelect(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              isSelected
                ? "bg-[#d95d39] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
