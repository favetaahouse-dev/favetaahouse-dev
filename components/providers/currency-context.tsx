"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { CURRENCIES, type CurrencyCode, formatMoney } from "@/lib/money";

type CurrencyCtx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  format: (cents: number) => string;
};

const Ctx = createContext<CurrencyCtx | null>(null);
const KEY = "currency";
const DEFAULT: CurrencyCode = "QAR";

/*
 * The stored preference is read through useSyncExternalStore rather than copied into state by
 * a mount effect. The effect version re-rendered every price on the page a second time on each
 * visit, and could not see a switch made in another tab.
 *
 * No snapshot caching is needed here because the snapshot is a string: Object.is compares it
 * by value, so returning it fresh on every read is stable.
 */
function readStore(): CurrencyCode {
  let saved: string | null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    return DEFAULT;
  }
  // A hand-edited or stale value would otherwise index CURRENCIES with undefined and throw
  // inside formatMoney.
  return saved && saved in CURRENCIES ? (saved as CurrencyCode) : DEFAULT;
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

// The server has no localStorage, so it renders the base currency and the first client paint
// matches the markup it hydrates.
const serverSnapshot = () => DEFAULT;

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const currency = useSyncExternalStore(subscribe, readStore, serverSnapshot);

  const setCurrency = useCallback((c: CurrencyCode) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* private mode / quota */
    }
    for (const l of listeners) l();
  }, []);

  const format = useCallback((cents: number) => formatMoney(cents, currency), [currency]);

  const value = useMemo<CurrencyCtx>(
    () => ({ currency, setCurrency, format }),
    [currency, setCurrency, format],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrency() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
