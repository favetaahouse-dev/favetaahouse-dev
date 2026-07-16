"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function RevenueChart({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C69229" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#C69229" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: "#222320", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 0, color: "#EDE9E6", fontSize: 12 }}
        />
        <Area type="monotone" name="Revenue (QAR)" dataKey="revenue" stroke="#C69229" strokeWidth={2} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
