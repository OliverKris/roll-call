import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getInbox, markAllRead, markRead, type Inbox } from "./api";
import { useApiErrorHandler, useAuth } from "./auth";

const POLL_MS = 60_000;

type InboxValue = {
  inbox: Inbox | null; // null until the first load finishes
  error: string | null;
  refreshedAt: number | null;
  refresh: () => Promise<void>;
  read: (id: string) => Promise<void>;
  readAll: () => Promise<void>;
};

const InboxContext = createContext<InboxValue | null>(null);

/**
 * The signed-in player's notifications, shared by the Inbox tab and its badge.
 * Checks again every minute while the app is open.
 */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const handleError = useApiErrorHandler();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const next = await getInbox(token);
      setInbox(next);
      setError(null);
      setRefreshedAt(Date.now());
    } catch (e) {
      // Keep what is already on screen; the Inbox shows the error inline
      setError(handleError(e));
    }
  }, [token, handleError]);

  useEffect(() => {
    if (!token) return;
    // First check right after sign-in, then every minute
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [token, refresh]);

  const read = useCallback(
    async (id: string) => {
      if (!token) return;
      // Update the screen first so the badge drops at once
      setInbox((prev) => {
        if (!prev) return prev;
        const target = prev.items.find((n) => n.id === id);
        if (!target || target.read_at) return prev;
        return {
          items: prev.items.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
          unread_count: Math.max(0, prev.unread_count - 1),
        };
      });
      try {
        await markRead(token, id);
      } catch {
        await refresh();
      }
    },
    [token, refresh],
  );

  const readAll = useCallback(async () => {
    if (!token) return;
    const stamp = new Date().toISOString();
    setInbox((prev) =>
      prev ? { items: prev.items.map((n) => ({ ...n, read_at: n.read_at ?? stamp })), unread_count: 0 } : prev,
    );
    try {
      await markAllRead(token);
    } catch {
      await refresh();
    }
  }, [token, refresh]);

  const value = useMemo<InboxValue>(
    () => ({ inbox: token ? inbox : null, error, refreshedAt, refresh, read, readAll }),
    [token, inbox, error, refreshedAt, refresh, read, readAll],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): InboxValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used inside InboxProvider");
  return ctx;
}
