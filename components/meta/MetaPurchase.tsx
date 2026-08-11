"use client";

import { useEffect } from "react";
import { trackMeta } from "@/lib/meta/fbq";
import type { MetaPayload } from "@/lib/meta/events";

/**
 * The browser half of Purchase.
 *
 * The order page is a plain, re-visitable page — the shopper lands on it after paying, but can
 * also open it from their order history next week. A naive mount-time Purchase would therefore
 * re-report the same revenue on every refresh and every later visit.
 *
 * Two guards, deliberately layered:
 *   1. A freshness window — 15 minutes is generous for "just came back from SkipCash" and far too
 *      short for "opened it from order history". The comparison happens HERE, in an effect,
 *      rather than on the server, because reading the clock during render is impure.
 *   2. A localStorage latch stops repeats from refreshing inside that window.
 *
 * And the backstop that makes even a failure benign: `eventId` is the ORDER UUID, identical to
 * the one the server-side Conversions API event uses. Meta deduplicates on (event_name,
 * event_id), so a shopper with storage disabled hammering refresh still yields ONE purchase.
 *
 * `payload` is built server-side by the same purchasePayload() the server event uses, so the two
 * halves cannot describe different money.
 */
const FRESH_WINDOW_MS = 15 * 60 * 1000;

export function MetaPurchase({
  orderId,
  paidAtMs,
  payload,
}: {
  orderId: string;
  paidAtMs: number;
  payload: MetaPayload;
}) {
  useEffect(() => {
    if (Date.now() - paidAtMs > FRESH_WINDOW_MS) return;
    const key = `meta_purchase_${orderId}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode). Fall through and fire — the shared event_id means the
      // worst case is a duplicate Meta dedups anyway.
    }
    trackMeta("Purchase", payload, orderId);
  }, [orderId, paidAtMs, payload]);

  return null;
}
