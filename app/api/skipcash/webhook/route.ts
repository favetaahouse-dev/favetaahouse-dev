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

    if (paid && pay?.order_id) {
      await markOrderPaid(pay.order_id, pay.cart_id ?? null, "skipcash", paymentId);
    }
  } catch (e) {
    console.error("[skipcash webhook] handler error", e);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
