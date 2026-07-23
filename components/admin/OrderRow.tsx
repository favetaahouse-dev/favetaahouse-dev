"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateOrder } from "@/lib/actions/admin";
import { formatMoney } from "@/lib/money";
import { usePermissions } from "@/lib/rbac/use-permissions";

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
    date: string;
  };
}) {
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(order.trackingNumber);
  const [busy, setBusy] = useState(false);
  const canWrite = usePermissions().can("orders:write");

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
        <div className="text-white/40">
          {order.date} · {order.itemCount} items
        </div>
      </td>
      <td className="px-3 py-3">{formatMoney(order.total, "QAR")}</td>
      <td className="px-3 py-3">
        {canWrite ? (
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
        ) : (
          <span className="text-xs">{status}</span>
        )}
      </td>
      <td className="px-3 py-3">
        {canWrite ? (
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="tracking #"
            className="w-32 border border-white/15 bg-transparent px-2 py-1 text-xs outline-none focus:border-signal"
          />
        ) : (
          <span className="text-xs text-white/60">{tracking || "—"}</span>
        )}
      </td>
      <td className="px-3 py-3">
        {canWrite && (
          <button onClick={save} disabled={busy} className="bg-signal px-3 py-1 text-xs font-medium text-white hover:opacity-90">
            Save
          </button>
        )}
      </td>
    </tr>
  );
}
