import "server-only";
import { META_GRAPH_VERSION, META_PIXEL_ID, type MetaEventName } from "./config";
import type { MetaPayload } from "./events";

/**
 * The Meta Conversions API client.
 *
 * THE ONE INVARIANT: this module never throws and never rejects. Ever.
 *
 * That is not defensive habit, it is load-bearing. The Purchase event is sent from
 * lib/actions/checkout.ts:markOrderPaid(), which is called by app/api/skipcash/webhook/route.ts —
 * and that route deliberately returns HTTP 500 on any thrown exception so SkipCash retries the
 * webhook (see the comment at its catch block). A rejected promise from here would therefore turn
 * a transient Graph API hiccup into a payment-webhook retry storm. A marketing pixel must never
 * be able to do that to a payments pipeline.
 */

const ACCESS_TOKEN = (process.env.META_CAPI_ACCESS_TOKEN ?? "").trim();

/**
 * Test Events code. This is a loaded gun: when `test_event_code` is present, Meta routes the
 * event ONLY to the Test Events stream — it counts for no optimisation, no attribution and no
 * reporting, and nothing anywhere says so. Leaving it set in production silently zeroes the
 * entire integration.
 *
 * So it is refused in production outright, mirroring the fail-closed demo-payment guard in
 * lib/actions/checkout.ts.
 */
const TEST_EVENT_CODE =
  process.env.VERCEL_ENV === "production" ? "" : (process.env.META_CAPI_TEST_EVENT_CODE ?? "").trim();

/** Server-side sending is live. Separate from the browser pixel: the token is what gates this. */
export const metaCapiEnabled = META_PIXEL_ID.length > 0 && ACCESS_TOKEN.length > 0;

/** Graph must answer quickly or not at all — a customer's receipt is behind this call. */
const TIMEOUT_MS = 3_000;

export type MetaUserData = {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  country?: string;
  external_id?: string;
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

export type CapiEvent = {
  event_name: MetaEventName;
  /** MUST equal the browser's `eventID` for the same action, or the pair double-counts. */
  event_id: string;
  event_source_url?: string;
  user_data: MetaUserData;
  custom_data?: MetaPayload;
  /** Unix SECONDS. Meta rejects milliseconds and events older than 7 days. */
  event_time?: number;
};

/**
 * Send one or more events. Resolves to whether Meta accepted them; never rejects.
 *
 * Awaited by callers rather than fired and forgotten: on Vercel a floating promise is not
 * guaranteed to run — the function can be frozen the moment the response is returned, so a
 * fire-and-forget send works perfectly in `npm run dev` and silently drops every event in
 * production. `@vercel/functions`' waitUntil would fix that properly, but it is not a dependency
 * here and 3s of bounded latency on a background webhook is not worth adding one.
 */
export async function sendCapiEvents(events: CapiEvent[]): Promise<boolean> {
  if (!metaCapiEnabled || events.length === 0) return false;

  const now = Math.floor(Date.now() / 1000);
  const body = {
    data: events.map((e) => ({
      event_name: e.event_name,
      event_time: e.event_time ?? now,
      event_id: e.event_id,
      // "website" tells Meta this originated from a browser session, even when we are relaying it
      // from a server. It is what makes browser/server deduplication apply.
      action_source: "website",
      ...(e.event_source_url ? { event_source_url: e.event_source_url } : {}),
      // Strip undefined: Meta rejects null values on user_data keys.
      user_data: Object.fromEntries(Object.entries(e.user_data).filter(([, v]) => v != null && v !== "")),
      ...(e.custom_data ? { custom_data: e.custom_data } : {}),
    })),
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Never let a marketing call sit in a data cache.
      cache: "no-store",
    });
    if (!res.ok) {
      // Meta returns a genuinely useful error body — log it rather than just the status, because
      // the usual causes (expired token, bad pixel id, malformed user_data) are only named there.
      const detail = await res.text().catch(() => "");
      console.error(`[meta] CAPI rejected ${events.map((e) => e.event_name).join(",")} — ${res.status} ${detail.slice(0, 400)}`);
      return false;
    }
    if (TEST_EVENT_CODE) {
      const json = (await res.json().catch(() => null)) as { events_received?: number; fbtrace_id?: string } | null;
      console.warn(`[meta] TEST MODE — events_received=${json?.events_received} fbtrace_id=${json?.fbtrace_id}`);
    }
    return true;
  } catch (e) {
    // Includes the AbortSignal timeout. Swallowed by design — see the invariant at the top.
    console.error(`[meta] CAPI send failed for ${events.map((ev) => ev.event_name).join(",")}`, e);
    return false;
  }
}
