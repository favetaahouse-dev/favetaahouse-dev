import "server-only";
import { Resend } from "resend";
import { getOrder } from "@/lib/data/orders";
import { getCommerceSettings, getSiteSettings } from "@/lib/content";
import { receiptEmailHtml, renderReceiptHtml } from "@/lib/receipt";
import { formatMoney } from "@/lib/money";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "FAVETAA <favetaahouse@gmail.com>";
// Store-owner inbox that gets a copy + full details of every paid order. Env-overridable.
const MERCHANT_NOTIFY_EMAIL = process.env.MERCHANT_NOTIFY_EMAIL || "favetaahouse@gmail.com";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Build a `Name <addr>` From header. Both halves are admin-editable (Commerce settings);
 * EMAIL_FROM is only the fallback for an install that has never set them. Note the address
 * must be on a Resend-verified domain or the send is rejected.
 */
function buildFrom(senderName: string, fromAddress: string): string {
  const m = EMAIL_FROM.match(/<([^>]+)>/);
  const addr = fromAddress.trim() || (m ? m[1] : EMAIL_FROM.trim());
  return senderName ? `${senderName} <${addr}>` : addr || EMAIL_FROM;
}

export type SendResult = { ok: boolean; reason?: "disabled" | "not-configured" | "no-order" | "send-error" };

/**
 * Email the order receipt to the buyer. Auto-called on the PAID transition (respects the
 * admin `emailEnabled` toggle); a manual admin resend passes `{ force: true }` to send
 * regardless of the toggle. Returns a real result so callers (e.g. the admin "Resend"
 * button) don't report success when nothing was actually sent.
 */
export async function sendOrderConfirmation(orderId: string, opts?: { force?: boolean }): Promise<SendResult> {
  const settings = await getCommerceSettings().catch(() => null);
  if (!settings) return { ok: false, reason: "not-configured" };
  if (!opts?.force && !settings.emailEnabled) return { ok: false, reason: "disabled" };
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping receipt for order ${orderId}`);
    return { ok: false, reason: "not-configured" };
  }
  const order = await getOrder(orderId);
  if (!order) return { ok: false, reason: "no-order" };
  const site = await getSiteSettings();

  try {
    const { error } = await resend.emails.send({
      from: buildFrom(settings.emailSenderName, settings.emailFromAddress),
      to: order.email,
      replyTo: settings.emailReplyTo || undefined,
      subject: `Your receipt — Order #${order.number} · FAVETAA`,
      html: receiptEmailHtml(order, {
        taxLabel: settings.taxLabel,
        storeLocation: site.storeLocation ?? "Doha, Qatar",
        contactEmail: site.contactEmail ?? "",
      }),
    });
    if (error) {
      // Resend returns { error } on API-level rejection (e.g. unverified From domain) — it does
      // not throw, so this must be checked explicitly.
      console.error(`[email] Resend rejected receipt for ${orderId}`, error);
      return { ok: false, reason: "send-error" };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[email] order receipt failed for ${orderId}`, e);
    return { ok: false, reason: "send-error" };
  }
}

/**
 * Notify the store owner of a new paid order: a summary banner plus the full receipt (customer
 * name, address, phone, email, items, totals, payment reference). Sent to MERCHANT_NOTIFY_EMAIL
 * (default favetaahouse@gmail.com; override with the MERCHANT_NOTIFY_EMAIL env var). Reply-to is
 * the customer, so replying reaches the buyer directly. Best-effort; never throws.
 */
export async function sendMerchantOrderEmail(orderId: string): Promise<SendResult> {
  if (!resend) return { ok: false, reason: "not-configured" };
  const settings = await getCommerceSettings().catch(() => null);
  if (!settings) return { ok: false, reason: "not-configured" };
  // Honour the same admin toggle as the customer receipt — turning "order emails" off should
  // silence the merchant copy too (and stops repeated Resend rejections on an unverified domain).
  if (!settings.emailEnabled) return { ok: false, reason: "disabled" };
  const order = await getOrder(orderId);
  if (!order) return { ok: false, reason: "no-order" };
  const site = await getSiteSettings();

  const receipt = renderReceiptHtml(order, {
    taxLabel: settings.taxLabel,
    storeLocation: site.storeLocation ?? "Doha, Qatar",
    contactEmail: site.contactEmail ?? "",
  });
  const total = formatMoney(order.total, "QAR");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f4f4f4;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto 12px;box-sizing:border-box;padding:16px 20px;background:#111111;color:#ffffff;">
      <div style="font-size:15px;font-weight:700;">New paid order · #${order.number}</div>
      <div style="font-size:13px;color:#cccccc;margin-top:4px;">${total} · ${order.email} · full details below</div>
    </div>
    ${receipt}
  </body></html>`;

  try {
    const { error } = await resend.emails.send({
      from: buildFrom(settings.emailSenderName, settings.emailFromAddress),
      to: MERCHANT_NOTIFY_EMAIL,
      replyTo: order.email,
      subject: `New order #${order.number} — ${total} · FAVETAA`,
      html,
    });
    if (error) {
      console.error(`[email] merchant notification rejected for ${orderId}`, error);
      return { ok: false, reason: "send-error" };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[email] merchant notification failed for ${orderId}`, e);
    return { ok: false, reason: "send-error" };
  }
}
