"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateOrder } from "@/lib/actions/admin";
import { formatMoney } from "@/lib/money";

const STATUSES = ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"];

export function OrderRow({
  order,
}: {
  order: {
    id: string;
    number: number;
    email: string;
    total: number;
    status: string;
    trackingNumber: string;
    itemCount: number;
    mtoCount: number;
    rtwCount: number;
    date: string;
  };
}) {
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(order.trackingNumber);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await updateOrder(order.id, { status, trackingNumber: tracking });
    setBusy(false);
    toast.success(`Order #${order.number} saved`);
  }

  return (
    <tr className="border-b border-white/5 align-top">
      <td className="px-5 py-3">#{order.number}</td>
      <td className="px-3 py-3 text-xs">
        <div>{order.email}</div>
        <div className="text-white/40">{order.date}</div>
      </td>
      {/* Which KIND of work an order carries decides who touches it next: made-to-order goes to
          the atelier to be cut, ready-to-wear goes to whoever picks and packs. Two labelled
          chips say that at a glance; a bare item count never did. */}
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {order.mtoCount > 0 && (
            <span
              title={`${order.mtoCount} made-to-order item(s) — needs the atelier`}
              className="border border-signal/50 bg-signal/10 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/80 uppercase"
            >
              {order.mtoCount} made-to-order
            </span>
          )}
          {order.rtwCount > 0 && (
            <span
              title={`${order.rtwCount} ready-to-wear item(s) — pick and pack`}
              className="border border-white/20 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/60 uppercase"
            >
              {order.rtwCount} ready-to-wear
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">{formatMoney(order.total, "QAR")}</td>
      <td className="px-3 py-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-white/15 bg-[#212121] px-2 py-1 text-xs outline-none focus:border-signal"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="tracking #"
          className="w-32 border border-white/15 bg-transparent px-2 py-1 text-xs outline-none focus:border-signal"
        />
      </td>
      <td className="px-3 py-3">
        <button onClick={save} disabled={busy} className="bg-signal px-3 py-1 text-xs font-medium text-white hover:opacity-90">
          Save
        </button>
      </td>
    </tr>
  );
}
