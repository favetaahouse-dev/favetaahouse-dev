import "server-only";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { getOrder, type OrderDTO } from "@/lib/data/orders";
import { getCommerceSettings, getSiteSettings } from "@/lib/content";
import { variantLabel } from "@/lib/variant-options";
import { formatMoney } from "@/lib/money";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "Alessia Abaya <orders@alessiaabaya.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

/**
 * Send the order-confirmation email exactly once, idempotently and retriably.
 *
 * An atomic "claim" on orders.email_sent_at is the concurrency gate: only the caller that flips
 * it NULL→now() (for a PAID order not yet emailed) sends, so concurrent webhook + browser-return
 * can't double-send. If Resend rejects or the process throws after claiming, the claim is
 * RELEASED (→NULL) so the next paid webhook/return retry resends — closing the at-most-once gap.
 * No-op (logged) when disabled or unconfigured.
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const settings = await getCommerceSettings().catch(() => null);
  if (!settings || !settings.emailEnabled) return;
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping confirmation for order ${orderId}`);
    return;
  }

  // Atomic claim: flip email_sent_at NULL→now() for a payable, not-yet-emailed order.
  const { data: claimed } = await supabase
    .from("orders")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("email_sent_at", null)
    .in("status", ["PAID", "FULFILLED"])
    .select("id")
    .maybeSingle();
  if (!claimed) return; // already sent/claimed, or not in a payable state

  const release = () => supabase.from("orders").update({ email_sent_at: null }).eq("id", orderId);

  try {
    const order = await getOrder(orderId);
    if (!order) return; // can't build the email; leave the claim rather than spin on a ghost order
    const site = await getSiteSettings();

    const { error } = await resend.emails.send({
      from: buildFrom(settings.emailSenderName, settings.emailFromAddress),
      to: order.email,
      replyTo: settings.emailReplyTo || undefined,
      subject: `Order #${order.number} confirmed — ALESSIA ABAYA`,
      html: renderOrderEmail(order, settings.taxLabel, site.storeLocation ?? ""),
    });
    if (error) {
      await release(); // Resend rejected (unverified domain, transient 5xx…) — allow a retry
      console.error(`[email] Resend rejected confirmation for ${orderId}`, error);
    }
  } catch (e) {
    await release(); // crash/throw after claim — release so a later retry can resend
    console.error(`[email] order confirmation failed for ${orderId}`, e);
  }
}

/**
 * Send an email-verification code. Unlike order email, this is NOT gated by the
 * `emailEnabled` commerce toggle — verification is essential to signup. If Resend
 * isn't configured (no RESEND_API_KEY, e.g. local dev), the code is logged so signup
 * still works locally.
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — verification code for ${email} is: ${code}`);
    return;
  }
  const settings = await getCommerceSettings().catch(() => null);
  const from = settings ? buildFrom(settings.emailSenderName, settings.emailFromAddress) : EMAIL_FROM;

  const { error } = await resend.emails.send({
    from,
    to: email,
    replyTo: settings?.emailReplyTo || undefined,
    subject: "Verify your email — ALESSIA ABAYA",
    html: renderVerificationEmail(code),
  });
  if (error) {
    console.error(`[email] Resend rejected verification for ${email}`, error);
    throw new Error("Could not send the verification email. Please try again.");
  }
}

function renderVerificationEmail(code: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f4f1;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding:8px 0 24px;">
      <div style="font-size:22px;letter-spacing:4px;color:#1b1a18;text-transform:uppercase;">ALESSIA ABAYA</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e2dc;padding:32px 28px;text-align:center;">
      <div style="font-size:18px;color:#1b1a18;">Confirm your email</div>
      <div style="font-size:13px;color:#8a8580;margin-top:8px;">Enter this code to activate your account.</div>
      <div style="margin:24px 0;font-size:34px;letter-spacing:10px;font-weight:600;color:#1b1a18;">${escapeHtml(code)}</div>
      <div style="font-size:12px;color:#a8a29c;">This code expires in 10 minutes. If you didn't create an account, you can ignore this email.</div>
    </div>
    <div style="text-align:center;padding:20px 0;font-size:11px;color:#a8a29c;">ALESSIA ABAYA</div>
  </div>
</body></html>`;
}

function renderOrderEmail(order: OrderDTO, taxLabel: string, storeLocation: string): string {
  const money = (c: number) => formatMoney(c, "QAR");
  const addr = order.shippingAddress as Record<string, string> | null;
  const rows = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">
          <div style="font-size:14px;color:#1b1a18;">${escapeHtml(it.title)}</div>
          <div style="font-size:12px;color:#8a8580;">${escapeHtml(variantLabel(it))} · × ${it.quantity}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#1b1a18;white-space:nowrap;">${money(it.price * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:3px 0;font-size:13px;color:${bold ? "#1b1a18" : "#8a8580"};${bold ? "font-weight:600;" : ""}">${label}</td>
      <td style="padding:3px 0;text-align:right;font-size:13px;color:#1b1a18;${bold ? "font-weight:600;" : ""}">${value}</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;background:#f6f4f1;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding:8px 0 24px;">
      <div style="font-size:22px;letter-spacing:4px;color:#1b1a18;text-transform:uppercase;">ALESSIA ABAYA</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e2dc;">
      <div style="padding:28px 28px 8px;text-align:center;">
        <div style="font-size:18px;color:#1b1a18;">Thank you for your order</div>
        <div style="font-size:13px;color:#8a8580;margin-top:6px;">Order #${order.number}</div>
      </div>
      <div style="padding:8px 28px 0;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
      <div style="padding:16px 28px 24px;border-top:1px solid #eee;margin-top:8px;">
        <table style="width:100%;border-collapse:collapse;">
          ${totalRow("Subtotal", money(order.subtotal))}
          ${order.discount > 0 ? totalRow(`Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}`, `− ${money(order.discount)}`) : ""}
          ${totalRow("Shipping", order.shipping > 0 ? money(order.shipping) : "Free")}
          ${order.tax > 0 ? totalRow(escapeHtml(taxLabel), money(order.tax)) : ""}
          ${totalRow("Total", money(order.total), true)}
        </table>
      </div>
      ${
        addr
          ? `<div style="padding:20px 28px;border-top:1px solid #eee;font-size:13px;color:#6b6660;line-height:1.6;">
              <div style="color:#1b1a18;font-weight:600;margin-bottom:4px;">${escapeHtml(addr.fullName ?? "")}</div>
              <div>${escapeHtml(addr.address ?? "")}${addr.address2 ? `, ${escapeHtml(addr.address2)}` : ""}</div>
              <div>${escapeHtml(addr.city ?? "")}, ${escapeHtml(addr.country ?? "")}</div>
              <div>${escapeHtml(addr.phone ?? "")}</div>
            </div>`
          : ""
      }
      <div style="padding:22px 28px;text-align:center;border-top:1px solid #eee;">
        <a href="${SITE_URL}/account/orders/${order.id}" style="display:inline-block;padding:12px 28px;background:#1b1a18;color:#fff;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;">View your order</a>
      </div>
    </div>
    <div style="text-align:center;padding:20px 0;font-size:11px;color:#a8a29c;">ALESSIA ABAYA${storeLocation ? ` · ${escapeHtml(storeLocation)}` : ""}</div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
