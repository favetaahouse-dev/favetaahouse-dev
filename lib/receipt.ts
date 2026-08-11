import { formatMoney } from "@/lib/money";
import { variantLabel } from "@/lib/variant-options";
import type { OrderDTO } from "@/lib/data/orders";

export type ReceiptOpts = { taxLabel: string; storeLocation: string; contactEmail: string };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/**
 * A black-and-white, print-ready order receipt as a self-contained, inline-styled HTML
 * fragment. Inline styles only (no Tailwind/external CSS) so the exact same markup survives
 * email clients AND prints cleanly. One source of truth for the emailed receipt (wrapped by
 * receiptEmailHtml) and the admin print page.
 */
export function renderReceiptHtml(order: OrderDTO, opts: ReceiptOpts): string {
  const money = (c: number) => formatMoney(c, "QAR");
  const addr = order.shippingAddress as Record<string, string> | null;
  const ink = "#111111";
  const rule = "#dddddd";
  const muted = "#666666";

  const itemRows = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${rule};vertical-align:top;">
          <div style="color:${ink};">${esc(it.title)}</div>
          <div style="color:${muted};font-size:12px;">${esc(variantLabel(it))}${it.sku ? ` &middot; ${esc(it.sku)}` : ""}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid ${rule};text-align:center;color:${ink};white-space:nowrap;">${it.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid ${rule};text-align:right;color:${muted};white-space:nowrap;">${money(it.price)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${rule};text-align:right;color:${ink};white-space:nowrap;">${money(it.price * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string) => `
    <tr>
      <td style="padding:3px 0;color:${muted};">${label}</td>
      <td style="padding:3px 0;text-align:right;color:${ink};white-space:nowrap;">${value}</td>
    </tr>`;

  const kv = (label: string, value: string) =>
    `<div style="margin-bottom:4px;"><span style="color:${muted};">${label}: </span><span style="color:${ink};">${value}</span></div>`;

  const th = `text-align:right;padding:0 0 8px;border-bottom:1px solid ${ink};color:${muted};font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:400;`;

  return `
  <div style="max-width:640px;margin:0 auto;background:#ffffff;color:${ink};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;padding:36px 40px;box-sizing:border-box;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:20px;letter-spacing:3px;text-transform:uppercase;font-weight:700;color:${ink};">FAVETAA</div>
          <div style="color:${muted};font-size:12px;margin-top:4px;">${esc(opts.storeLocation || "Doha, Qatar")}</div>
          ${opts.contactEmail ? `<div style="color:${muted};font-size:12px;">${esc(opts.contactEmail)}</div>` : ""}
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-size:15px;letter-spacing:2px;text-transform:uppercase;color:${ink};">Receipt</div>
          <div style="color:${muted};font-size:12px;margin-top:4px;">Order #${order.number}</div>
          <div style="color:${muted};font-size:12px;">${fmtDate(order.createdAt)}</div>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:2px solid ${ink};margin:18px 0;" />

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          <div style="color:${muted};text-transform:uppercase;letter-spacing:1px;font-size:11px;margin-bottom:6px;">Billed to</div>
          ${
            addr
              ? `<div style="color:${ink};font-weight:700;">${esc(addr.fullName ?? "")}</div>
                 <div style="color:${muted};">${esc(addr.address ?? "")}${addr.address2 ? `, ${esc(addr.address2)}` : ""}</div>
                 <div style="color:${muted};">${esc(addr.city ?? "")}${addr.country ? `, ${esc(addr.country)}` : ""}</div>
                 <div style="color:${muted};">${esc(addr.phone ?? "")}</div>`
              : ""
          }
          <div style="color:${muted};">${esc(order.email)}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="color:${muted};text-transform:uppercase;letter-spacing:1px;font-size:11px;margin-bottom:6px;">Details</div>
          ${kv("Status", esc(order.status))}
          ${order.paymentProvider ? kv("Payment", esc(order.paymentProvider.toUpperCase())) : ""}
          ${order.paymentRef ? kv("Reference", esc(order.paymentRef)) : ""}
          ${order.paidAt ? kv("Paid", fmtDate(order.paidAt)) : ""}
          ${order.trackingNumber ? kv("Tracking", esc(order.trackingNumber)) : ""}
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:0 0 8px;border-bottom:1px solid ${ink};color:${muted};font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:400;">Item</th>
          <th style="${th}text-align:center;padding-left:8px;padding-right:8px;">Qty</th>
          <th style="${th}padding-left:8px;padding-right:8px;">Unit</th>
          <th style="${th}">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="width:52%;"></td>
        <td>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            ${totalRow("Subtotal", money(order.subtotal))}
            ${order.discount > 0 ? totalRow(`Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ""}`, `&minus; ${money(order.discount)}`) : ""}
            ${totalRow("Shipping", order.shipping > 0 ? money(order.shipping) : "Free")}
            ${order.tax > 0 ? totalRow(esc(opts.taxLabel || "Tax"), money(order.tax)) : ""}
            <tr>
              <td style="padding:12px 0 0;border-top:2px solid ${ink};font-weight:700;font-size:15px;color:${ink};">Total</td>
              <td style="padding:12px 0 0;border-top:2px solid ${ink};text-align:right;font-weight:700;font-size:15px;color:${ink};white-space:nowrap;">${money(order.total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1px solid ${rule};margin:28px 0 14px;" />
    <div style="text-align:center;color:${muted};font-size:12px;line-height:1.7;">
      <div style="color:${ink};">Thank you for shopping with FAVETAA.</div>
      ${opts.contactEmail ? `<div>Questions? ${esc(opts.contactEmail)}</div>` : ""}
      <div>Returns &amp; exchanges within 15 days with the original invoice. All prices in QAR.</div>
    </div>
  </div>`;
}

/** Wrap the receipt fragment in a full HTML document for email delivery. */
export function receiptEmailHtml(order: OrderDTO, opts: ReceiptOpts): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f4f4;padding:24px 0;">${renderReceiptHtml(order, opts)}</body></html>`;
}
