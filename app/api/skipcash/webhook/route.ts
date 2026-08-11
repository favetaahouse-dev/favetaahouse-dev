import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import {
  skipcashEnabled,
  verifyWebhook,
  getPayment,
  PAID_STATUS_ID,
  type SkipcashWebhookFields,
} from "@/lib/skipcash";
import { markOrderPaid } from "@/lib/actions/checkout";

function str(v: unknown): string | undefined {
  return v === undefined || v === null ? undefined : String(v);
}

export async function POST(req: NextRequest) {
  if (!skipcashEnabled) return new Response("skipcash disabled", { status: 200 });

  const raw = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = Object.fromEntries(new URLSearchParams(raw));
  }

  const fields: SkipcashWebhookFields = {
    PaymentId: str(payload.PaymentId ?? payload.paymentId),
    Amount: str(payload.Amount ?? payload.amount),
    StatusId: str(payload.StatusId ?? payload.statusId),
    TransactionId: str(payload.TransactionId ?? payload.transactionId),
    Custom1: str(payload.Custom1 ?? payload.custom1),
    VisaId: str(payload.VisaId ?? payload.visaId),
  };

  if (!verifyWebhook(fields, req.headers.get("authorization"))) {
    return new Response("invalid signature", { status: 400 });
  }

  const paymentId = fields.PaymentId;
  if (!paymentId) return new Response("no payment id", { status: 200 });

  try {
    const { data: pay } = await supabase
      .from("payments")
      .select("order_id, cart_id")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();

    // Authoritative re-query — never fulfill on the webhook body alone.
    const verified = await getPayment(paymentId);
    const statusId = verified?.statusId ?? Number(fields.StatusId);
    const paid = statusId === PAID_STATUS_ID;

    await supabase
      .from("payments")
      .update({ ...(paid ? { status: "paid" } : {}), status_id: statusId, raw: payload as unknown as Json })
      .eq("provider_payment_id", paymentId);

    if (paid) {
      // Resolve the order: prefer OUR payments row, then the authoritative getPayment
      // TransactionId, then the signed webhook TransactionId — so a missing payments row
      // (e.g. a failed checkout insert) can't strand a genuinely-paid charge as PENDING.
      const orderId = pay?.order_id ?? verified?.transactionId ?? fields.TransactionId ?? null;
      if (orderId) {
        const { data: order, error: orderErr } = await supabase.from("orders").select("total").eq("id", orderId).maybeSingle();
        // A transient lookup FAILURE (not a genuine mismatch) must not silently strand a paid
        // order: throw so the outer catch returns 500 and SkipCash retries the webhook.
        if (orderErr) throw orderErr;
        // Defense-in-depth: the authoritative payment must reference THIS order and its amount.
        const txnOk = !verified?.transactionId || verified.transactionId === orderId;
        const amountOk =
          !verified?.amount || !order || Math.round(parseFloat(String(verified.amount)) * 100) === order.total;
        if (order && txnOk && amountOk) {
          await markOrderPaid(orderId, pay?.cart_id ?? null, "skipcash", paymentId);
        } else {
          console.error("[skipcash webhook] payment/order mismatch — not fulfilling", {
            orderId,
            verifiedTxn: verified?.transactionId,
            verifiedAmount: verified?.amount,
            orderTotal: order?.total,
          });
        }
      }
    }
  } catch (e) {
    console.error("[skipcash webhook] handler error", e);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
