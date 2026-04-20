'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Role = 'SUPER_ADMIN' | 'SUPPLIER' | 'AFFILIATE' | 'COURIER' | 'CLIENT';

interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Rafraîchit la session ; retourne le nouvel access token ou null si échec */
  refreshUser: () => Promise<string | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

async function parseResJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text?.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Rafraîchit le token en arrière-plan. En cas d’échec, on ne déconnecte pas : la session reste jusqu’au clic sur Déconnexion. */
  const refreshUser = useCallback(async (): Promise<string | null> => {
    const refresh = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
    if (!refresh) {
      setIsLoading(false);
      return null;
    }
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        setIsLoading(false);
        return null;
      }
      const data = await parseResJson(res);
      const newToken = (data.accessToken as string) ?? null;
      const newUser = data.user as User | undefined;
      setToken(newToken);
      setUser(newUser ?? null);
      if (typeof window !== 'undefined') {
        if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
        const newRefresh = data.refreshToken as string | undefined;
        if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh);
        if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      }
      return newToken;
    } catch {
      setIsLoading(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem(USER_KEY);
    if (t) {
      setToken(t);
      if (u) {
        try {
          setUser(JSON.parse(u) as User);
        } catch {
          setUser(null);
        }
      }
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseResJson(res);
    if (!res.ok) {
      throw new Error((data.error as string) ?? (data.message as string) ?? 'Connexion échouée');
    }
    const u = data.user as User;
    setToken(data.accessToken as string);
    setUser(u);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, data.accessToken as string);
      localStorage.setItem(REFRESH_KEY, (data.refreshToken as string) ?? '');
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
