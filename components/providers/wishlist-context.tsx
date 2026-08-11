"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

type WishlistCtx = {
  handles: string[];
  has: (handle: string) => boolean;
  toggle: (handle: string) => void;
  count: number;
  ready: boolean;
};

const Ctx = createContext<WishlistCtx | null>(null);
const KEY = "wishlist";
const EMPTY: string[] = [];

/*
 * localStorage is an external store, so it is subscribed to rather than copied into state by
 * a mount effect. That read-then-setState cost every visit an extra render of the whole tree
 * under the provider, and left two provider instances — or two tabs — free to disagree.
 *
 * useSyncExternalStore compares snapshots with Object.is, so the parsed array has to be cached
 * and rebuilt only when the raw string actually changes; parsing on every read would hand React
 * a new array each time and loop forever.
 */
let rawCache: string | null = null;
let parsedCache: string[] = EMPTY;

function readStore(): string[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== rawCache) {
    rawCache = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      parsedCache = Array.isArray(parsed) ? (parsed as string[]) : EMPTY;
    } catch {
      parsedCache = EMPTY;
    }
  }
  return parsedCache;
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // `storage` fires only in the *other* tabs, so writes made here notify explicitly below.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function write(next: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — the in-memory snapshot below still updates */
  }
  rawCache = null; // force the next readStore() to re-parse
  for (const l of listeners) l();
}

// The server cannot read localStorage, so it renders the empty wishlist and the first client
// paint matches the markup it hydrates. `ready` is what tells consumers that has happened.
const serverHandles = () => EMPTY;
const serverReady = () => false;
const clientReady = () => true;

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const handles = useSyncExternalStore(subscribe, readStore, serverHandles);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);

  // Reads the store rather than closing over `handles`, so two toggles in the same tick
  // cannot drop one another's write.
  const toggle = useCallback((handle: string) => {
    const current = readStore();
    write(current.includes(handle) ? current.filter((h) => h !== handle) : [...current, handle]);
  }, []);

  // Memoised: a fresh object literal here re-rendered every WishlistButton on the page
  // — up to 99 of them on a collection — whenever any single one was toggled.
  const value = useMemo<WishlistCtx>(
    () => ({
      handles,
      has: (h: string) => handles.includes(h),
      toggle,
      count: handles.length,
      ready,
    }),
    [handles, toggle, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
