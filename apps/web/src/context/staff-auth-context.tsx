"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@civictrack/contracts";

export interface StaffUserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole.ADMIN | UserRole.OFFICER;
  department?: {
    _id: string;
    name: string;
    code: string;
  };
}

interface StaffAuthContextType {
  user: StaffUserProfile | null;
  role: UserRole.ADMIN | UserRole.OFFICER | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const StaffAuthContext = createContext<StaffAuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function StaffAuthProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole.ADMIN | UserRole.OFFICER;
}) {
  const router = useRouter();
  const [user, setUser] = useState<StaffUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const endpoint = role === UserRole.ADMIN ? "/api/v1/admin/auth" : "/api/v1/officer/auth";
  const loginPath = role === UserRole.ADMIN ? "/admin/login" : "/officer/login";

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch(`${endpoint}/me`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUser(json.data);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const logout = async () => {
    try {
      await fetch(`${endpoint}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Continue client logout
    }
    setUser(null);
    router.push(loginPath);
    router.refresh();
  };

  return (
    <StaffAuthContext.Provider
      value={{
        user,
        role: user?.role || role,
        isLoading,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  return useContext(StaffAuthContext);
}
