import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCart } from "@/lib/data/cart";
import { rateLimit, ipFrom } from "@/lib/rate-limit";
import { metaCapiEnabled } from "@/lib/meta/capi";
import { sendMetaCheckoutEvent } from "@/lib/meta/server-events";
import { initiateCheckoutPayload, addPaymentInfoPayload } from "@/lib/meta/events";

/**
 * Relay a browser event to the Conversions API so Meta receives it from both sides.
 *
 * Some events have no natural server moment — InitiateCheckout is just a navigation to
 * /checkout, and AddPaymentInfo is a button click. A beacon is the only honest way to give them
 * server coverage, but it means exposing an endpoint that writes into the owner's ad
 * optimisation model. So it is built to assume the caller is hostile:
 *
 *   1. ALLOW-LIST of event names. Purchase and AddToCart are rejected outright — those are sent
 *      from markOrderPaid and addToCartAction respectively, and are not reachable from here.
 *      Without this, anyone could POST fake revenue and poison the ad account's optimisation.
 *   2. `value` and `contents` are NEVER taken from the request body. They are rebuilt server-side
 *      from the caller's own cart (read via the httpOnly cartId cookie) using the same builders
 *      the browser used. The body may only say WHICH event and WHICH dedup id.
 *   3. Rate limited per IP.
 *
 * Fire-and-forget from the client's perspective: it always answers 200 so a tracking failure can
 * never surface as an error in the shopper's console or block a redirect to the payment page.
 */

const Body = z.object({
  // Only the two events that genuinely lack a server moment.
  event: z.enum(["InitiateCheckout", "AddPaymentInfo"]),
  eventId: z.string().trim().min(8).max(64),
  eventSourceUrl: z.string().url().max(500).optional(),
  fbc: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  // Validate BEFORE the enabled check, deliberately. If the disabled path returned early, the
  // allow-list would be unobservable in any environment without a token — including every test —
  // and a body that gets rejected today would start being accepted the moment a token is added.
  // The gate belongs on SENDING, not on validating.
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  // 200, not 4xx: the browser has already fired its half and there is nothing it can do about a
  // server relay that is switched off.
  if (!metaCapiEnabled) return NextResponse.json({ ok: true, sent: false, reason: "disabled" });

  const ip = ipFrom(req.headers);
  // Generous — a shopper can legitimately revisit checkout several times — but bounded.
  if (!(await rateLimit(`meta:${ip}`, 60, 60))) {
    return NextResponse.json({ ok: true, sent: false, throttled: true });
  }

  // The authority for what is being bought is the cart, not the caller.
  const cart = await getCart();
  if (!cart.items.length) return NextResponse.json({ ok: true, sent: false, reason: "empty-cart" });

  const lines = cart.items.map((i) => ({
    handle: i.handle,
    title: i.title,
    priceFils: i.price,
    quantity: i.quantity,
  }));

  const { event, eventId, eventSourceUrl, fbc } = parsed.data;
  const payload = event === "AddPaymentInfo" ? addPaymentInfoPayload(lines) : initiateCheckoutPayload(lines);

  await sendMetaCheckoutEvent({ event, eventId, payload, eventSourceUrl, clientFbc: fbc });
  return NextResponse.json({ ok: true, sent: true });
}
