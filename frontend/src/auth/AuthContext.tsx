// Auth state for TeachOps. Email/password JWT plus a demo role switcher.
// Token persisted in secure storage; kept in sync with the api client.

import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useState } from "react";

import { apiFetch, setAuthToken } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "teachops_token";

export type Role = "teacher" | "coordinator" | "administrator" | "owner";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  role_label: string;
  centre: string | null;
  organisation: string | null;
  organisation_id: string | null;
  initials: string;
};

type AuthValue = {
  user: AppUser | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (role: "Teacher" | "Coordinator" | "Administrator") => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function persistToken(token: string) {
  setAuthToken(token);
  await storage.secureSet(TOKEN_KEY, token);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [booting, setBooting] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet(TOKEN_KEY, "");
      if (token) {
        setAuthToken(token);
        try {
          const me = await apiFetch<AppUser>("/auth/me");
          setUser(me);
        } catch {
          setAuthToken(null);
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setBooting(false);
    })();
  }, []);

  const applyLogin = async (resp: { token: string; user: AppUser }) => {
    await persistToken(resp.token);
    await qc.cancelQueries();
    qc.clear();
    setUser(resp.user);
  };

  const login = async (email: string, password: string) => {
    const resp = await apiFetch<{ token: string; user: AppUser }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await applyLogin(resp);
  };

  const demoLogin = async (role: "Teacher" | "Coordinator" | "Administrator") => {
    const resp = await apiFetch<{ token: string; user: AppUser }>("/auth/demo-login", {
      method: "POST",
      body: { role },
    });
    await applyLogin(resp);
  };

  const logout = async () => {
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    qc.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, booting, login, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
