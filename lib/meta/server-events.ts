import "server-only";
import { cookies, headers } from "next/headers";
import { sendCapiEvents, metaCapiEnabled, type MetaUserData } from "./capi";
import { hashCity, hashCountry, hashEmail, hashExternalId, hashName, hashPhone, splitFullName } from "./hash";
import type { MetaPayload } from "./events";
import type { MetaEventName } from "./config";

/**
 * Server-side Conversions API senders.
 *
 * Every function here is void-returning and swallowing — see the invariant at the top of capi.ts.
 * Nothing in this file may ever be the reason a checkout, a webhook or a cart update fails.
 */

/**
 * Attribution captured in the browser and persisted on the order.
 *
 * This exists because the authoritative Purchase is sent from the SkipCash webhook, where the
 * request belongs to SkipCash — its IP, its user agent, none of its cookies. Without a snapshot
 * taken during a real browser request, the server Purchase would describe the payment provider
 * rather than the customer.
 */
export type MetaAttribution = {
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
  url?: string;
  ts?: number;
};

/** Shape stored in orders.marketing_attribution — namespaced so another network can be added. */
export type MarketingAttribution = { meta?: MetaAttribution };

/**
 * Snapshot the current request's Meta identifiers.
 *
 * `_fbp`/`_fbc` are FIRST-PARTY cookies on our own domain, so they ride along on Server Action
 * POSTs for free — no client plumbing needed for the common case. `clientFbc` is a fallback for
 * when fbevents.js never got to write `_fbc` (blocked, or the visitor navigated too fast) and
 * lib/meta/fbq.ts synthesised one from `?fbclid`.
 */
export async function captureAttribution(clientFbc?: string, clientUrl?: string): Promise<MetaAttribution> {
  try {
    const [c, h] = await Promise.all([cookies(), headers()]);
    const xff = h.get("x-forwarded-for");
    return {
      fbp: c.get("_fbp")?.value,
      fbc: c.get("_fbc")?.value ?? clientFbc,
      ip: xff ? xff.split(",")[0]!.trim() : h.get("x-real-ip") ?? undefined,
      ua: h.get("user-agent") ?? undefined,
      url: clientUrl ?? h.get("referer") ?? undefined,
      ts: Math.floor(Date.now() / 1000),
    };
  } catch {
    return {};
  }
}

/** Build Meta's user_data from whatever identifiers are available. All PII is hashed. */
function userData(input: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  country?: string | null;
  externalId?: string | null;
  attribution?: MetaAttribution;
}): MetaUserData {
  const { firstName, lastName } = splitFullName(input.fullName);
  const a = input.attribution ?? {};
  return {
    em: hashEmail(input.email),
    ph: hashPhone(input.phone),
    fn: hashName(firstName),
    ln: hashName(lastName),
    ct: hashCity(input.city),
    country: hashCountry(input.country),
    external_id: hashExternalId(input.externalId),
    fbp: a.fbp,
    fbc: a.fbc,
    client_ip_address: a.ip,
    client_user_agent: a.ua,
  };
}

/** The generic sender. Callers below give it a payload; it never throws. */
async function send(
  event: MetaEventName,
  eventId: string,
  payload: MetaPayload,
  identity: Parameters<typeof userData>[0],
  eventSourceUrl?: string,
): Promise<void> {
  if (!metaCapiEnabled) return;
  try {
    await sendCapiEvents([
      {
        event_name: event,
        event_id: eventId,
        event_source_url: eventSourceUrl ?? identity.attribution?.url,
        user_data: userData(identity),
        custom_data: payload,
      },
    ]);
  } catch (e) {
    // sendCapiEvents already swallows; this is the belt to its braces.
    console.error(`[meta] ${event} send threw unexpectedly`, e);
  }
}

/**
 * AddToCart from a Server Action — the request IS the shopper's browser, so cookies, IP and
 * user-agent are all genuinely theirs and no stored attribution is needed.
 */
export async function sendMetaAddToCart(args: {
  eventId: string;
  payload: MetaPayload;
  eventSourceUrl?: string;
  clientFbc?: string;
}): Promise<void> {
  if (!metaCapiEnabled) return;
  const attribution = await captureAttribution(args.clientFbc, args.eventSourceUrl);
  await send("AddToCart", args.eventId, args.payload, { attribution }, args.eventSourceUrl ?? attribution.url);
}

/** InitiateCheckout / AddPaymentInfo relayed from the beacon route. */
export async function sendMetaCheckoutEvent(args: {
  event: Extract<MetaEventName, "InitiateCheckout" | "AddPaymentInfo" | "ViewContent" | "Search" | "AddToWishlist">;
  eventId: string;
  payload: MetaPayload;
  eventSourceUrl?: string;
  clientFbc?: string;
  email?: string | null;
}): Promise<void> {
  if (!metaCapiEnabled) return;
  const attribution = await captureAttribution(args.clientFbc, args.eventSourceUrl);
  await send(args.event, args.eventId, args.payload, { attribution, email: args.email }, args.eventSourceUrl ?? attribution.url);
}

/**
 * Purchase — the one that matters.
 *
 * Called from lib/actions/checkout.ts inside markOrderPaid's `if (transitioned)` block, which is
 * the only exactly-once guarantee in the codebase. `event_id` is the order uuid, which the
 * browser side derives independently from the route param, so the two merge with no plumbing.
 *
 * Identity comes from the ORDER, not the request — because the request is usually SkipCash's.
 */
export async function sendMetaPurchase(args: {
  orderId: string;
  payload: MetaPayload;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  country?: string | null;
  userId?: string | null;
  attribution?: MetaAttribution;
}): Promise<void> {
  if (!metaCapiEnabled) return;
  await send(
    "Purchase",
    args.orderId,
    args.payload,
    {
      email: args.email,
      phone: args.phone,
      fullName: args.fullName,
      city: args.city,
      country: args.country,
      // orders.user_id is null for guest checkouts (most of them), so fall back to the order id:
      // a stable, non-guessable id Meta can use to stitch repeat purchases together.
      externalId: args.userId ?? args.orderId,
      attribution: args.attribution,
    },
    args.attribution?.url,
  );
}
