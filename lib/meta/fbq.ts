"use client";

import { META_PIXEL_ID, metaPixelEnabled, type MetaEventName } from "./config";
import type { MetaPayload } from "./events";

/**
 * Browser-side pixel helpers.
 *
 * Everything here is a no-op when the pixel is unconfigured or the script has not loaded yet, so
 * callers never have to guard. `fbq` is stubbed by Meta's own snippet the moment it runs (it
 * queues into `fbq.queue` until fbevents.js arrives), but an ad blocker can remove it entirely —
 * hence the typeof check on every call rather than just at init.
 */

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[] };
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** Where a synthesised click id is kept. See captureFbclid. */
const FBC_KEY = "meta_fbc";

const readCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
};

/** Meta's browser id cookie, written by fbevents.js. */
export const readFbp = (): string | undefined => readCookie("_fbp");

/**
 * Meta's click id. fbevents.js only writes `_fbc` when the LANDING url carried `?fbclid` — if the
 * pixel was blocked, or slow, or the visitor navigated before it loaded, the click is lost and
 * every downstream conversion becomes unattributable.
 *
 * So we capture `fbclid` ourselves into localStorage in Meta's documented format. We deliberately
 * do NOT write the `_fbc` cookie: fbevents.js owns that name, and two writers race.
 */
export function captureFbclid(): void {
  if (typeof window === "undefined") return;
  try {
    const id = new URLSearchParams(window.location.search).get("fbclid");
    // "fb.1.<creation-ms>.<fbclid>" — the 1 is the subdomain index for an eTLD+1-scoped cookie,
    // which is where fbevents.js writes it.
    if (id) window.localStorage.setItem(FBC_KEY, `fb.1.${Date.now()}.${id}`);
  } catch {
    // Private mode / storage disabled. Attribution degrades; nothing breaks.
  }
}

export const readFbc = (): string | undefined => {
  const cookie = readCookie("_fbc");
  if (cookie) return cookie;
  try {
    return window.localStorage.getItem(FBC_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

/**
 * Events called before fbevents.js has been injected.
 *
 * This buffer is not belt-and-braces, it is required. The base snippet is injected by next/script
 * with `afterInteractive`, which makes NO ordering guarantee relative to React effects — in
 * practice the first render's effects run first, so a component that tracks on mount finds no
 * `window.fbq` at all. Dropping the call there loses the event permanently (measured: PageView
 * silently never fired, fbq.queue empty, no /tr request). Meta's own snippet stub cannot help,
 * because it does not exist yet either.
 *
 * So calls are held here and replayed the moment fbq appears.
 */
type PendingEvent = [MetaEventName, MetaPayload | undefined, string | undefined];
let pending: PendingEvent[] = [];
let poller: ReturnType<typeof setInterval> | null = null;

const fbqReady = (): boolean => typeof window !== "undefined" && typeof window.fbq === "function";

function emit(event: MetaEventName, payload?: MetaPayload, eventId?: string): void {
  try {
    // The 4th argument is omitted rather than passed as undefined when there is no event id —
    // fbq inspects arguments.length in places, and an explicit undefined is not the same as absent.
    if (eventId) window.fbq!("track", event, payload ?? {}, { eventID: eventId });
    else window.fbq!("track", event, payload ?? {});
  } catch (e) {
    console.error("[meta] fbq track failed", e);
  }
}

function flushPending(): boolean {
  if (!fbqReady()) return false;
  const queued = pending;
  pending = [];
  for (const [event, payload, eventId] of queued) emit(event, payload, eventId);
  return true;
}

/** Poll briefly for the script. Gives up after ~10s — by then it is blocked, not slow. */
function waitForFbq(): void {
  if (poller !== null || typeof window === "undefined") return;
  let tries = 0;
  poller = setInterval(() => {
    tries += 1;
    if (flushPending() || tries >= 50) {
      clearInterval(poller!);
      poller = null;
      if (tries >= 50 && pending.length) {
        console.warn(`[meta] fbevents.js never loaded — dropping ${pending.length} queued event(s)`);
        pending = [];
      }
    }
  }, 200);
}

/**
 * Track a standard event.
 *
 * `eventId` is not optional in practice — it is what lets Meta merge this with the matching
 * server event instead of counting both. Anything sent from both sides MUST pass one.
 */
export function trackMeta(event: MetaEventName, payload?: MetaPayload, eventId?: string): void {
  if (!metaPixelEnabled || typeof window === "undefined") return;
  if (fbqReady()) {
    flushPending(); // keep ordering: anything buffered goes out before this
    emit(event, payload, eventId);
    return;
  }
  pending.push([event, payload, eventId]);
  waitForFbq();
}

/**
 * Ask the server to send the same event via the Conversions API, with the same event_id.
 *
 * `keepalive` matters: InitiateCheckout fires as the shopper is about to be redirected to
 * SkipCash, and a normal fetch is cancelled the moment the page unloads.
 *
 * Never awaited and never surfaced — a failed relay costs match quality, not correctness, and the
 * browser event has already been sent.
 */
export function relayMeta(event: MetaEventName, eventId: string, extra?: Record<string, unknown>): void {
  if (!metaPixelEnabled || typeof window === "undefined") return;
  try {
    void fetch("/api/meta/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event,
        eventId,
        eventSourceUrl: window.location.href,
        fbp: readFbp(),
        fbc: readFbc(),
        ...extra,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignore — see above.
  }
}

/** A fresh dedup key. crypto.randomUUID is available in every browser this site supports. */
export const newEventId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export { META_PIXEL_ID, metaPixelEnabled };
