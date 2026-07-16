"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI card: label, big value, optional delta chip, optional sparkline. */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  spark,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: number; // signed % change vs previous period
  icon?: ReactNode;
  spark?: number[];
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="border border-edge bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-faint">{label}</p>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        {spark && spark.length > 1 && (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark.map((v, i) => ({ i, v }))}>
                <Line type="monotone" dataKey="v" stroke="var(--admin-accent)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {(delta != null || hint) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {delta != null && (
            <span className={cn("inline-flex items-center gap-0.5", up ? "text-positive" : "text-danger")}>
              {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-faint">{hint}</span>}
        </div>
      )}
    </div>
  );
}
