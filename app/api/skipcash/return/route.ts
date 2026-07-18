import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { skipcashEnabled, getPayment, PAID_STATUS_ID } from "@/lib/skipcash";
import { markOrderPaid } from "@/lib/actions/checkout";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Browser return target after the SkipCash hosted page. Reconciles against the
// authoritative payment status (handles the race where the shopper returns
// before the async webhook), then redirects to the order confirmation page.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const paymentId = sp.get("id") || sp.get("paymentId");
  let orderId = sp.get("orderId") || sp.get("transactionId");
  let ref: string | null = paymentId;
  let cartId: string | null = null;

  try {
    if (skipcashEnabled) {
      if (!orderId && paymentId) {
        const { data } = await supabase
          .from("payments")
          .select("order_id, cart_id")
          .eq("provider_payment_id", paymentId)
          .maybeSingle();
        orderId = data?.order_id ?? null;
        cartId = data?.cart_id ?? null;
      } else if (orderId) {
        const { data } = await supabase
          .from("payments")
          .select("provider_payment_id, cart_id")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        ref = ref ?? data?.provider_payment_id ?? null;
        cartId = data?.cart_id ?? null;
      }
      if (ref && orderId) {
        const verified = await getPayment(ref);
        if (verified?.statusId === PAID_STATUS_ID) {
          await markOrderPaid(orderId, cartId, "skipcash", ref);
        }
      }
    }
  } catch (e) {
    console.error("[skipcash return] reconcile error", e);
  }

  const dest = orderId ? `${ORIGIN}/account/orders/${orderId}` : `${ORIGIN}/`;
  return NextResponse.redirect(dest);
}
