"use server";

import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getCart, getCartCoupon, CART_COOKIE } from "@/lib/data/cart";
import { skipcashEnabled, createPayment } from "@/lib/skipcash";
import { sendOrderConfirmation, sendMerchantOrderEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import { getOrder, getOrderItemHandles } from "@/lib/data/orders";
import { metaCapiEnabled } from "@/lib/meta/capi";
import { captureAttribution, sendMetaPurchase, type MarketingAttribution } from "@/lib/meta/server-events";
import { purchasePayload } from "@/lib/meta/events";
import { splitFullName } from "@/lib/meta/hash";

const CheckoutSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  address2: z.string().max(300).optional(),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  locale: z.string().max(8),
  /**
   * Meta click attribution, supplied by the browser. Optional and bounded — it is captured at
   * checkout because the Purchase event is later sent from the SkipCash webhook, where the
   * request belongs to SkipCash and carries none of the shopper's cookies. `fbc` is only a
   * fallback for when fbevents.js never wrote the _fbc cookie; the real one is read server-side
   * from the request in captureAttribution().
   */
  metaFbc: z.string().max(255).optional(),
  metaEventSourceUrl: z.string().url().max(500).optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

const localePath = (locale: string) => (locale === "en" ? "" : `/${locale}`);

export async function createCheckout(
  input: CheckoutInput,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  const cart = await getCart();
  if (!cart.items.length) return { ok: false, error: "empty" };

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const coupon = cart.id ? await getCartCoupon(cart.id) : null;
  const items = cart.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    length: i.length,
    tack_tack: i.tackTack,
  }));

  const { data: res, error } = await supabase.rpc("create_order", {
    p_email: data.email,
    p_user_id: userId as string,
    p_address: {
      fullName: data.fullName,
      address: data.address,
      address2: data.address2 ?? "",
      city: data.city,
      country: data.country,
      phone: data.phone,
    },
    p_currency: "QAR",
    p_items: items,
    p_coupon: coupon ?? undefined,
  });

  if (error || !res) {
    const msg = (error?.message ?? "").toLowerCase();
    return { ok: false, error: msg.includes("stock") ? "stock" : "error" };
  }
  const order = res as {
    id: string;
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };

  // Snapshot the shopper's Meta identifiers NOW, while this request is genuinely theirs. The
  // Purchase event is sent later from the SkipCash webhook, where the request is SkipCash's —
  // without this the server-side conversion would carry no _fbp, no _fbc and the wrong IP.
  const metaAttribution: MarketingAttribution = {
    meta: await captureAttribution(data.metaFbc, data.metaEventSourceUrl),
  };

  // ── SkipCash (QAR-native hosted payment page) ──
  if (skipcashEnabled) {
    try {
      const uid = randomUUID();
      const { firstName, lastName } = splitFullName(data.fullName);
      const { id: paymentId, payUrl } = await createPayment({
        uid,
        amount: (order.total / 100).toFixed(2), // QAR minor units → major units string
        firstName,
        lastName,
        phone: data.phone,
        email: data.email,
        transactionId: order.id,
        custom1: cart.id ?? "",
      });
      const { error: payErr } = await supabase.from("payments").insert({
        order_id: order.id,
        cart_id: cart.id,
        provider: "skipcash",
        provider_payment_id: paymentId,
        uid,
        transaction_id: order.id,
        amount: order.total,
        currency: "QAR",
        status: "new",
      });
      if (payErr) {
        // The charge isn't live until the shopper opens payUrl, so fail the checkout rather
        // than redirect with no payment→order mapping row (which would strand a paid order).
        console.error("[checkout] payments insert failed", payErr);
        return { ok: false, error: "payment" };
      }
      // Attribution folded into the UPDATE that was happening anyway — no extra round trip.
      await supabase
        .from("orders")
        .update({
          payment_provider: "skipcash",
          payment_ref: paymentId,
          marketing_attribution: metaAttribution as never,
        })
        .eq("id", order.id);
      return { ok: true, url: payUrl };
    } catch (e) {
      console.error("[checkout] SkipCash create failed", e);
      return { ok: false, error: "payment" };
    }
  }

  // ── Demo mode (no SkipCash keys) ──
  // Fail CLOSED in production: never auto-fulfill a real order for free just because a SkipCash
  // key is missing/typo'd. Demo auto-pay is only for local/preview development.
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    console.error("[checkout] SkipCash not configured in production — refusing to auto-fulfill", order.id);
    return { ok: false, error: "payment" };
  }
  await supabase.from("payments").insert({
    order_id: order.id,
    cart_id: cart.id,
    provider: "demo",
    amount: order.total,
    currency: "QAR",
    status: "paid",
    status_id: 2,
  });
  // Demo has no separate orders UPDATE to ride along on, so attribution gets its own — and it
  // must land BEFORE markOrderPaid, which is what reads it back to build the Purchase event.
  await supabase
    .from("orders")
    .update({ marketing_attribution: metaAttribution as never })
    .eq("id", order.id);
  await markOrderPaid(order.id, cart.id, "demo", null);
  return { ok: true, url: `${localePath(data.locale)}/account/orders/${order.id}?demo=1` };
}

/**
 * Idempotent mark-paid via RPC (also used by the SkipCash webhook + return handler).
 * Sends the confirmation email exactly once, on the real PENDING→PAID transition.
 */
export async function markOrderPaid(
  orderId: string,
  cartId: string | null,
  provider?: string | null,
  reference?: string | null,
): Promise<boolean> {
  const { data } = await supabase.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_cart_id: cartId ?? undefined,
    p_provider: provider ?? undefined,
    p_reference: reference ?? undefined,
  });
  const transitioned = data === true;
  if (transitioned) {
    await sendOrderConfirmation(orderId); // receipt → customer
    await sendMerchantOrderEmail(orderId); // full order details + receipt → store owner
    // A paid order may have decremented a variant's stock to 0 — expire the cached catalog
    // so the storefront stops showing a sold-out variant as buyable. revalidateTag(tag, {expire})
    // works in BOTH Server Actions and Route Handlers (the real SkipCash webhook/return path),
    // unlike updateTag which throws — and was silently swallowed — outside a Server Action.
    revalidateTag("products", { expire: 0 });
    // Meta Purchase, server side. LAST on purpose: the customer's receipt matters more than the
    // pixel, so a slow Graph call never sits in front of it. It can never throw — which is not
    // optional here, because this function is called by the SkipCash webhook, and that route
    // returns 500 on any exception to make SkipCash retry. A marketing call must not be able to
    // trigger a payment-webhook retry storm.
    await reportPurchaseToMeta(orderId);
  }
  return transitioned;
}

/**
 * Build and send the server-side Purchase for an order that has just been paid.
 *
 * Kept out of markOrderPaid's body so the exactly-once block stays readable, and so this can be
 * called directly by a backfill if one is ever needed. Fully self-contained and non-throwing.
 */
async function reportPurchaseToMeta(orderId: string): Promise<void> {
  if (!metaCapiEnabled) return;
  try {
    const order = await getOrder(orderId);
    if (!order) return;

    // order_items stores variant_id but no product handle, so resolve them in one scoped query
    // rather than widening ORDER_SELECT (which feeds receipts, emails and the admin list).
    const handles = await getOrderItemHandles(orderId);
    const lines = order.items.map((i) => ({
      // Falls back to "" when the product was deleted (order_items.variant_id is ON DELETE SET
      // NULL). mergeByHandle still counts it in value and num_items — see lib/meta/events.ts.
      handle: handles.get(i.id) ?? "",
      title: i.title,
      priceFils: i.price,
      quantity: i.quantity,
    }));

    const addr = (order.shippingAddress ?? {}) as Record<string, string | undefined>;
    const attribution = (order.marketingAttribution as MarketingAttribution | null)?.meta;

    await sendMetaPurchase({
      orderId: order.id,
      payload: purchasePayload({ lines, totalFils: order.total }),
      email: order.email,
      phone: addr.phone,
      fullName: addr.fullName,
      city: addr.city,
      country: addr.country,
      userId: order.userId,
      attribution,
    });
  } catch (e) {
    console.error("[meta] purchase report failed", orderId, e);
  }
}

export async function clearCartAction() {
  const store = await cookies();
  const id = store.get(CART_COOKIE)?.value;
  if (id) await supabase.from("cart_items").delete().eq("cart_id", id);
}
