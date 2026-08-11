"use client";

import { useState } from "react";
import { toast } from "sonner";
import { resendReceipt } from "@/lib/actions/admin";

/** Print (or Save-as-PDF) the current receipt page. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-signal px-3 py-1 text-xs font-medium text-white hover:opacity-90"
    >
      Print / Save as PDF
    </button>
  );
}

/** Re-email the receipt to the buyer. Gate the render with <Can permission="orders:write">. */
export function ResendReceiptButton({ orderId, orderNumber }: { orderId: string; orderNumber: number }) {
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      const res = await resendReceipt(orderId);
      if (res?.ok) toast.success(`Receipt for #${orderNumber} emailed to the buyer`);
      else toast.error("Could not send the receipt");
    } catch {
      toast.error("Could not send the receipt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={resend}
      disabled={busy}
      className="border border-white/20 px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
    >
      {busy ? "Sending…" : "Resend to buyer"}
    </button>
  );
}
