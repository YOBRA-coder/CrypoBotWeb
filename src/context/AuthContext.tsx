// context/AuthContext.tsx

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { AuthState, User } from "../types";
import { authApi } from "../api/client";

interface AuthContextType {
  auth: AuthState;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const STORAGE_KEY = "nexusai_auth";

function loadAuth(): AuthState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { user: null, token: null, loading: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({ ...loadAuth(), loading: false }));

  const persist = (state: AuthState) => {
    setAuth(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { token, user } = await authApi.login(email, password);
      persist({ user, token, loading: false });
      return true;
    } catch { return false; }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const { token, user } = await authApi.signup(name, email, password);
      persist({ user, token, loading: false });
      return true;
    } catch { return false; }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth({ user: null, token: null, loading: false });
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (!auth.user) return;
    const updated = { ...auth, user: { ...auth.user, ...updates } };
    persist(updated);
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
