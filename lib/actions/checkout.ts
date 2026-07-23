"use server";

import { cookies, headers } from "next/headers";
import { randomUUID } from "crypto";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getCart, getCartCoupon, CART_COOKIE } from "@/lib/data/cart";
import { skipcashEnabled, createPayment } from "@/lib/skipcash";
import { sendOrderConfirmation } from "@/lib/email";
import { rateLimit, ipFrom } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

const CheckoutSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  address2: z.string().max(300).optional(),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  locale: z.string().max(8),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

const localePath = (locale: string) => (locale === "en" ? "" : `/${locale}`);

export async function createCheckout(
  input: CheckoutInput,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;

  // Per-IP rate limit before any DB work — curbs order-table + SkipCash createPayment spam.
  // Fails open (a limiter blip never blocks a real checkout).
  if (!(await rateLimit(`checkout:${ipFrom(await headers())}`, 20, 60))) {
    return { ok: false, error: "rate" };
  }

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

  // ── SkipCash (QAR-native hosted payment page) ──
  if (skipcashEnabled) {
    try {
      const uid = randomUUID();
      const [firstName, ...rest] = data.fullName.split(/\s+/);
      const lastName = rest.join(" ") || firstName;
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
        // than redirect with no payment→order mapping row. (The webhook's TransactionId
        // fallback is the backstop for a crash that happens after this point.)
        console.error("[checkout] payments insert failed", payErr);
        return { ok: false, error: "payment" };
      }
      await supabase
        .from("orders")
        .update({ payment_provider: "skipcash", payment_ref: paymentId })
        .eq("id", order.id);
      return { ok: true, url: payUrl };
    } catch (e) {
      console.error("[checkout] SkipCash create failed", e);
      return { ok: false, error: "payment" };
    }
  }

  // ── Demo mode (no SkipCash keys): mark paid immediately ──
  await supabase.from("payments").insert({
    order_id: order.id,
    cart_id: cart.id,
    provider: "demo",
    amount: order.total,
    currency: "QAR",
    status: "paid",
    status_id: 2,
  });
  await markOrderPaid(order.id, cart.id, "demo", null);
  return { ok: true, url: `${localePath(data.locale)}/account/orders/${order.id}?demo=1` };
}

/**
 * Idempotent mark-paid via RPC (also used by the SkipCash webhook + return handler).
 * The confirmation email is triggered on every paid invocation, not just the PENDING→PAID
 * transition: sendOrderConfirmation self-dedupes via an atomic claim, so a webhook/return retry
 * re-sends a confirmation that was lost on an earlier attempt without ever double-sending.
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
  await sendOrderConfirmation(orderId);
  return transitioned;
}

export async function clearCartAction() {
  const store = await cookies();
  const id = store.get(CART_COOKIE)?.value;
  if (id) await supabase.from("cart_items").delete().eq("cart_id", id);
}
