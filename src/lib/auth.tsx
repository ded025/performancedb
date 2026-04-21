import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AppRole = "admin" | "viewer";

const STORAGE_KEY = "ap_gate_role";
const VIEWER_CODE = "fyers";
const ADMIN_CODE = "admin123";

type AuthState = {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthed: boolean;
  enter: (code: string) => { ok: boolean };
  signOut: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (v === "admin" || v === "viewer") setRole(v);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const enter = (code: string) => {
    const trimmed = code.trim();
    let next: AppRole | null = null;
    if (trimmed === ADMIN_CODE) next = "admin";
    else if (trimmed === VIEWER_CODE) next = "viewer";
    if (!next) return { ok: false };
    setRole(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    return { ok: true };
  };

  const signOut = () => {
    setRole(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <AuthCtx.Provider
      value={{
        role,
        loading,
        isAdmin: role === "admin",
        isAuthed: role !== null,
        enter,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
