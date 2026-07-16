"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { type CurrencyCode, formatMoney } from "@/lib/money";

type CurrencyCtx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  format: (cents: number) => string;
};

const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("QAR");

  useEffect(() => {
    const saved = localStorage.getItem("currency") as CurrencyCode | null;
    if (saved) setCurrencyState(saved);
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("currency", c);
  }, []);

  const format = useCallback((cents: number) => formatMoney(cents, currency), [currency]);

  return <Ctx.Provider value={{ currency, setCurrency, format }}>{children}</Ctx.Provider>;
}

export function useCurrency() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
