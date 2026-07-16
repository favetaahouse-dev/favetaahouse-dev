"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type WishlistCtx = {
  handles: string[];
  has: (handle: string) => boolean;
  toggle: (handle: string) => void;
  count: number;
  ready: boolean;
};

const Ctx = createContext<WishlistCtx | null>(null);
const KEY = "wishlist";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [handles, setHandles] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setHandles(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const persist = useCallback((next: string[]) => {
    setHandles(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const toggle = useCallback(
    (handle: string) =>
      persist(
        handles.includes(handle) ? handles.filter((h) => h !== handle) : [...handles, handle],
      ),
    [handles, persist],
  );

  return (
    <Ctx.Provider
      value={{ handles, has: (h) => handles.includes(h), toggle, count: handles.length, ready }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
