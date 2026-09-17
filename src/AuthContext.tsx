import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, registerUser } from "./api";

interface AuthState {
  token: string | null;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "taskhub_token";
const USERNAME_KEY = "taskhub_username";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY),
  );

  const value = useMemo<AuthState>(
    () => ({
      token,
      username,
      async login(u: string, p: string) {
        const { access_token } = await apiLogin(u, p);
        localStorage.setItem(TOKEN_KEY, access_token);
        localStorage.setItem(USERNAME_KEY, u);
        setToken(access_token);
        setUsername(u);
      },
      async register(u: string, p: string) {
        await registerUser(u, p);
        // Registration doesn't issue a token, so log in right after.
        const { access_token } = await apiLogin(u, p);
        localStorage.setItem(TOKEN_KEY, access_token);
        localStorage.setItem(USERNAME_KEY, u);
        setToken(access_token);
        setUsername(u);
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USERNAME_KEY);
        setToken(null);
        setUsername(null);
      },
    }),
    [token, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
