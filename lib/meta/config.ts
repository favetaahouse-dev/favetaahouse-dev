/**
 * Meta Pixel + Conversions API configuration.
 *
 * Isomorphic on purpose — no `server-only`, no `"use client"`. The pixel id is public (it ships
 * in the browser snippet by definition); only the access token is a secret, and it is read
 * exclusively by lib/meta/capi.ts which IS server-only.
 *
 * Everything here follows the repo's "blank means off" convention (see `skipcashEnabled` in
 * lib/skipcash.ts and the RESEND_API_KEY gate in lib/email.ts): an unconfigured install is
 * completely inert rather than half-broken.
 */

/** Public — ships to the browser. Safe: a pixel id is not a credential. */
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();

/** Browser pixel is live. Server CAPI has its own, stricter gate (see capi.ts). */
export const metaPixelEnabled = META_PIXEL_ID.length > 0;

/**
 * Graph API version, pinned. Meta deprecates versions on a ~2-year clock; an unpinned URL would
 * change behaviour under us without a deploy.
 */
export const META_GRAPH_VERSION = "v21.0";

/**
 * Server-relayed events. Everything here is ALSO sent from the browser with the same event_id,
 * so Meta merges the pair rather than double-counting.
 *
 * ViewContent is deliberately absent. Product pages are prerendered and served from the CDN, so
 * relaying one would spend a Vercel invocation (region sin1) on every product view — for the
 * lowest-weight event in the funnel. Add "ViewContent" here to turn it on; nothing else changes.
 */
export const SERVER_RELAYED_EVENTS = ["InitiateCheckout", "AddPaymentInfo"] as const;
export type ServerRelayedEvent = (typeof SERVER_RELAYED_EVENTS)[number];

/** The standard events this integration sends. Meta matches these names exactly — do not rename. */
export const META_EVENTS = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Search",
  "AddToWishlist",
  "Contact",
  "CompleteRegistration",
] as const;
export type MetaEventName = (typeof META_EVENTS)[number];

/**
 * The store charges in QAR and only QAR — see lib/actions/checkout.ts, which hardcodes
 * `p_currency: "QAR"`. components/providers/currency-context.tsx is a COSMETIC display switcher
 * (localStorage, static conversion rates); a shopper browsing in USD is still charged QAR.
 * Reading that switcher here would misreport ROAS by ~3.6x, so this is a constant.
 */
export const META_CURRENCY = "QAR";

/**
 * Prices are stored as integer minor units (fils). Meta wants major units — 90000 -> 900.
 * Rounded to 2dp because floating division can produce 899.9999999999999.
 */
export function toMajorUnits(fils: number): number {
  return Math.round(fils) / 100;
}
