import React from 'react';
import { api } from '../utils/api';

const TOKEN_KEY = 'moneyflow_auth_token';
const USERNAME_KEY = 'moneyflow_auth_username';

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isLoggedIn: boolean;
  login: (username: string, pin: string) => Promise<void>;
  register: (username: string, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = React.useState<string | null>(() => localStorage.getItem(USERNAME_KEY));

  // Verify token on mount; if invalid, clear silently
  React.useEffect(() => {
    if (!token) return;
    api.me(token).catch((err) => {
      if (err?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USERNAME_KEY);
        setToken(null);
        setUsername(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (t: string, u: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USERNAME_KEY, u);
    setToken(t);
    setUsername(u);
  };

  const login = async (u: string, pin: string) => {
    const res = await api.login(u, pin);
    persist(res.token, res.username);
  };

  const register = async (u: string, pin: string) => {
    const res = await api.register(u, pin);
    persist(res.token, res.username);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, isLoggedIn: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
