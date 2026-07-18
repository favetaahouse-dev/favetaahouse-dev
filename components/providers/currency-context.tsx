"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { type CurrencyCode, formatMoney } from "@/lib/money";

type CurrencyCtx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  format: (cents: number) => string;
};

const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("QAR");

  // The stored preference can only be read after mount — the server has no access to
  // localStorage, and seeding state from it during the first render would not match the
  // prerendered HTML. Skipping the update when it already agrees with the default keeps
  // the common case from re-rendering every price on the page for nothing.
  useEffect(() => {
    const saved = localStorage.getItem("currency") as CurrencyCode | null;
    if (saved && saved !== currency) setCurrencyState(saved);
    // Runs once on mount; `currency` is read only to skip a redundant set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("currency", c);
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
