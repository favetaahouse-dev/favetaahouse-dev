import "server-only";
import crypto from "crypto";

// SkipCash — Qatar payment gateway (QAR-native). Hosted-payment-page flow.
// Auth = HMAC-SHA256(base64) of non-empty body fields joined as `Key=Value,...`
// in a fixed order, signed with the Key Secret, sent in the `Authorization` header.

const ENV = (process.env.SKIPCASH_ENV || "sandbox").toLowerCase();
const BASE_URL = ENV === "production" ? "https://api.skipcash.app" : "https://skipcashtest.azurewebsites.net";

const CLIENT_ID = process.env.SKIPCASH_CLIENT_ID || "";
const KEY_ID = process.env.SKIPCASH_KEY_ID || "";
const KEY_SECRET = process.env.SKIPCASH_KEY_SECRET || "";
const WEBHOOK_KEY = process.env.SKIPCASH_WEBHOOK_KEY || "";

const isReal = (v: string) => !!v && !v.toLowerCase().includes("placeholder");

/** True when live SkipCash credentials are configured (else checkout falls back to demo mode). */
export const skipcashEnabled =
  isReal(CLIENT_ID) && isReal(KEY_ID) && isReal(KEY_SECRET) && isReal(WEBHOOK_KEY);

export const SKIPCASH_ENV = ENV;
/** SkipCash statusId for a successful payment. */
export const PAID_STATUS_ID = 2;

// Field order is load-bearing — must match the SkipCash Integration Manual exactly.
const CREATE_FIELD_ORDER = [
  "Uid", "KeyId", "Amount", "FirstName", "LastName", "Phone", "Email",
  "Street", "City", "State", "Country", "PostalCode", "TransactionId", "Custom1",
] as const;
const WEBHOOK_FIELD_ORDER = ["PaymentId", "Amount", "StatusId", "TransactionId", "Custom1", "VisaId"] as const;

/** HMAC-SHA256(base64) over non-empty fields joined as `Key=Value,...` in `order`. */
function sign(fields: Record<string, unknown>, order: readonly string[], key: string): string {
  const parts: string[] = [];
  for (const k of order) {
    const v = fields[k];
    if (v !== undefined && v !== null && String(v).length > 0) parts.push(`${k}=${v}`);
  }
  return crypto.createHmac("sha256", key).update(parts.join(",")).digest("base64");
}

export type CreatePaymentInput = {
  uid: string; // merchant-generated GUID (idempotency key)
  amount: string; // QAR major units, e.g. "350.00"
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  transactionId: string; // our order id
  custom1?: string; // we pass the cart id here
};

/** Create a hosted payment and return the payment id + redirect URL. */
export async function createPayment(input: CreatePaymentInput): Promise<{ id: string; payUrl: string }> {
  const body: Record<string, string> = {
    Uid: input.uid,
    KeyId: KEY_ID,
    Amount: input.amount,
    FirstName: input.firstName,
    LastName: input.lastName,
    Phone: input.phone,
    Email: input.email,
    TransactionId: input.transactionId,
  };
  if (input.custom1) body.Custom1 = input.custom1;

  const res = await fetch(`${BASE_URL}/api/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: sign(body, CREATE_FIELD_ORDER, KEY_SECRET) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  const obj = json?.resultObj;
  if (!res.ok || json?.hasError || !obj?.payUrl) {
    const detail = json?.errorMessage ?? JSON.stringify(json?.validationErrors ?? json);
    throw new Error(`SkipCash create payment failed (${res.status}): ${detail}`);
  }
  return { id: String(obj.id), payUrl: String(obj.payUrl) };
}

export type SkipcashWebhookFields = {
  PaymentId?: string;
  Amount?: string | number;
  StatusId?: string | number;
  TransactionId?: string;
  Custom1?: string;
  VisaId?: string;
};

/** Verify an incoming webhook's Authorization header against the webhook key (timing-safe). */
export function verifyWebhook(fields: SkipcashWebhookFields, authHeader: string | null): boolean {
  if (!authHeader || !WEBHOOK_KEY) return false;
  const expected = sign(fields as Record<string, unknown>, WEBHOOK_FIELD_ORDER, WEBHOOK_KEY);
  const a = Buffer.from(expected);
  const b = Buffer.from(authHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Authoritative status re-query — never fulfill on the webhook body alone. */
export async function getPayment(
  id: string,
): Promise<{ statusId: number; status: string; amount: string; transactionId: string } | null> {
  const res = await fetch(`${BASE_URL}/api/v1/payments/${id}`, { headers: { Authorization: CLIENT_ID } });
  const json = await res.json().catch(() => null);
  const obj = json?.resultObj;
  if (!res.ok || !obj) return null;
  return {
    statusId: Number(obj.statusId),
    status: String(obj.status ?? ""),
    amount: String(obj.amount ?? ""),
    transactionId: String(obj.transactionId ?? ""),
  };
}
