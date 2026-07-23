import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { skipcashEnabled, getPayment, PAID_STATUS_ID } from "@/lib/skipcash";
import { markOrderPaid } from "@/lib/actions/checkout";
import { rateLimit, ipFrom } from "@/lib/rate-limit";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Browser return target after the SkipCash hosted page. The fulfillment decision is bound
// STRICTLY to our own payments row (written at checkout) and re-verified against SkipCash —
// never to the client-supplied query params, which an attacker fully controls. Passing a
// mismatched id/orderId pair therefore cannot mark an unpaid order paid. Then it redirects
// to the order confirmation page.
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`skipcash_return:${ipFrom(req.headers)}`, 60, 60))) {
    return new Response("rate limited", { status: 429 });
  }

  const sp = req.nextUrl.searchParams;
  const paymentId = sp.get("id") || sp.get("paymentId");
  const orderIdParam = sp.get("orderId") || sp.get("transactionId");
  let redirectOrderId: string | null = null;

  type PayRow = {
    order_id: string;
    cart_id: string | null;
    provider_payment_id: string | null;
    amount: number;
  };

  try {
    if (skipcashEnabled) {
      // The trusted payment→order binding is the row WE wrote at checkout. Resolve it by the
      // SkipCash payment id (preferred) or the order id — but always read provider_payment_id
      // and amount from OUR row, so the client cannot rebind a paid payment to another order.
      const sel = "order_id, cart_id, provider_payment_id, amount";
      let pay: PayRow | null = null;
      if (paymentId) {
        const { data } = await supabase
          .from("payments")
          .select(sel)
          .eq("provider_payment_id", paymentId)
          .maybeSingle();
        pay = data as PayRow | null;
      } else if (orderIdParam) {
        const { data } = await supabase
          .from("payments")
          .select(sel)
          .eq("order_id", orderIdParam)
          .eq("provider", "skipcash")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        pay = data as PayRow | null;
      }

      if (pay?.order_id) {
        redirectOrderId = pay.order_id;
        if (pay.provider_payment_id) {
          // Authoritative status re-query, cross-checked against OUR order id + amount.
          const verified = await getPayment(pay.provider_payment_id);
          if (
            verified &&
            verified.statusId === PAID_STATUS_ID &&
            verified.transactionId === pay.order_id &&
            Math.round(parseFloat(verified.amount) * 100) === pay.amount
          ) {
            await markOrderPaid(pay.order_id, pay.cart_id ?? null, "skipcash", pay.provider_payment_id);
          }
        }
      }
    }
  } catch (e) {
    console.error("[skipcash return] reconcile error", e);
  }

  const dest = redirectOrderId ? `${ORIGIN}/account/orders/${redirectOrderId}` : `${ORIGIN}/`;
  return NextResponse.redirect(dest);
}
