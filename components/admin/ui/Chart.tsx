"use client";

import type { ComponentProps } from "react";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/** Wrap a numeric formatter into recharts' Tooltip.formatter shape (version-agnostic). */
type TooltipFormatter = NonNullable<ComponentProps<typeof Tooltip>["formatter"]>;
const mkFmt = (fmt?: (v: number) => string): TooltipFormatter | undefined =>
  fmt ? (((value: unknown) => fmt(Number(value))) as unknown as TooltipFormatter) : undefined;

/**
 * Serializable formatter descriptor. Functions can't be passed from a Server
 * Component to a Client Component, so charts accept a token (`"money"` | `"number"`)
 * plus an optional currency and resolve it to a real formatter here on the client.
 */
export type ChartFormat = "money" | "number";
const numberFmt = new Intl.NumberFormat("en-US");
const resolveFmt = (format: ChartFormat | undefined, currency: CurrencyCode): Fmt | undefined => {
  if (format === "money") return (v) => formatMoney(v, currency);
  if (format === "number") return (v) => numberFmt.format(v);
  return undefined;
};

const AXIS = { fill: "var(--admin-faint)", fontSize: 11 } as const;
const GRID = "var(--admin-edge)";
const tooltipStyle = {
  background: "var(--admin-surface)",
  border: "1px solid var(--admin-edge)",
  borderRadius: 0,
  color: "var(--admin-foreground)",
  fontSize: 12,
} as const;

export const CHART_COLORS = [
  "var(--admin-accent)", "var(--admin-info)", "var(--admin-positive)",
  "var(--admin-warn)", "var(--admin-danger)", "#9b8cc4", "#7bb0a3",
];

type Fmt = (v: number) => string;

export function AreaTrend({
  data, xKey, yKey, height = 240, color = "var(--admin-accent)", format, currency = "QAR",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  format?: ChartFormat;
  currency?: CurrencyCode;
}) {
  const gid = `area-${yKey}`;
  const fmt = resolveFmt(format, currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={fmt} />
        <Tooltip contentStyle={tooltipStyle} formatter={mkFmt(fmt)} />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data, xKey, yKey, height = 240, color = "var(--admin-accent)", format, currency = "QAR",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
  format?: ChartFormat;
  currency?: CurrencyCode;
}) {
  const fmt = resolveFmt(format, currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={fmt} />
        <Tooltip cursor={{ fill: "var(--admin-elevated)" }} contentStyle={tooltipStyle} formatter={mkFmt(fmt)} />
        <Bar dataKey={yKey} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({
  data, xKey, yKeys, height = 240, format, currency = "QAR",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  height?: number;
  format?: ChartFormat;
  currency?: CurrencyCode;
}) {
  const fmt = resolveFmt(format, currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={fmt} />
        <Tooltip contentStyle={tooltipStyle} formatter={mkFmt(fmt)} />
        {yKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data, height = 240,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--admin-surface)" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
