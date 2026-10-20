import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, describeError, login } from "./api";

type Session = { token: string; userId: string; username: string; expiresAt: number };

type AuthValue = {
  token: string | null;
  userId: string | null;
  username: string | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const KEY = "rollcall.session";
const AuthContext = createContext<AuthValue | null>(null);

/** Read the user ID (`sub`) from the token. Display only; the gateway does the real verification. */
function decodeSub(token: string): string {
  const part = token.split(".")[1] ?? "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  try {
    return JSON.parse(atob(b64)).sub ?? "";
  } catch {
    return "";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Session;
          if (saved.expiresAt > Date.now()) setSession(saved);
          else await SecureStore.deleteItemAsync(KEY);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { access_token, expires_in } = await login(username, password);
    const next: Session = {
      token: access_token,
      userId: decodeSub(access_token),
      username,
      expiresAt: Date.now() + (expires_in - 30) * 1000,
    };
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY);
    setSession(null);
  }, []);

  // Sign out automatically when the token expires
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      void SecureStore.deleteItemAsync(KEY);
      setSession(null);
    }, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      token: session?.token ?? null,
      userId: session?.userId ?? null,
      username: session?.username ?? null,
      ready,
      signIn,
      signOut,
    }),
    [session, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Turn an error into a message; a 401 also signs the user out. */
export function useApiErrorHandler() {
  const { signOut } = useAuth();
  return useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) void signOut();
      return describeError(e);
    },
    [signOut],
  );
}
