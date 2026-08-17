import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/admin-guard";
import { getOrder } from "@/lib/data/orders";
import { getMadeToOrderSettings } from "@/lib/content";
import { formatMoney } from "@/lib/money";
// variantLabel is gone from this page on purpose: it collapses a line into "Black / M / 56" /
// Tack Tack", which is right for a cart drawer but hides exactly what the atelier needs. The
// fields are now labelled individually below.
import { Can } from "@/components/admin/ui/PermissionGate";
import { ResendReceiptButton } from "@/components/admin/OrderReceiptActions";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("orders:read");
  const { id } = await params;
  const order = await getOrder(id);
  const mto = await getMadeToOrderSettings();
  // key -> label. A key the CMS no longer defines still prints, under its raw name: an order
  // placed before a schema edit must not lose the measurement the customer paid for.
  const measureLabel = (k: string) => mto.fields.find((f) => f.key === k)?.label ?? k;
  if (!order) notFound();
  const addr = order.shippingAddress as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/orders" className="text-xs text-signal hover:underline">
        ← Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/orders/${order.id}/receipt`}
          className="border border-white/20 px-3 py-1 text-xs hover:bg-white/5"
        >
          View / Print receipt
        </Link>
        <Can permission="orders:write">
          <ResendReceiptButton orderId={order.id} orderNumber={order.number} />
        </Can>
      </div>

      <div className="mt-4 border border-white/10 bg-[#212121]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Order #{order.number}</p>
            <p className="text-xs text-white/40">
              {order.createdAt.toLocaleString("en-US")} · {order.email}
            </p>
          </div>
          <span className="bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em]">{order.status}</span>
        </div>

        <div className="divide-y divide-white/5 px-5">
          {order.items.map((it) => {
            const mto = it.fulfillment === "MTO";
            return (
              <div key={it.id} className="flex gap-4 py-4">
                <div className="relative aspect-[4/5] w-14 shrink-0 bg-black/20">
                  {it.imageUrl && <Image src={it.imageUrl} alt={it.title} fill sizes="56px" className="object-cover" />}
                </div>
                <div className="flex-1 text-sm">
                  {/* The kind of line leads, because it decides who handles it: an atelier cuts
                      a made-to-order piece from measurements, a packer pulls a stocked size off
                      the rail. Reading that off a "/"-joined label was guesswork. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        mto
                          ? "border border-signal/50 bg-signal/10 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/80 uppercase"
                          : "border border-white/20 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/60 uppercase"
                      }
                    >
                      {mto ? "Made to order" : "Ready to wear"}
                    </span>
                    <span>{it.title}</span>
                    <span className="text-xs text-white/40">× {it.quantity}</span>
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="text-white/40">Colour</dt>
                      <dd>{it.color || "—"}</dd>
                    </div>
                    {/* Ready-to-wear detail: what came off the rail. */}
                    {!mto && (
                      <>
                        <div className="flex gap-1.5">
                          <dt className="text-white/40">Size</dt>
                          <dd>{it.size || "—"}</dd>
                        </div>
                        {it.length != null && it.length > 0 && (
                          <div className="flex gap-1.5">
                            <dt className="text-white/40">Length</dt>
                            <dd dir="ltr">{it.length}&quot;</dd>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex gap-1.5">
                      <dt className="text-white/40">Tack Tack</dt>
                      <dd>{it.tackTack ? "Yes" : "No"}</dd>
                    </div>
                    {it.sku && (
                      <div className="flex gap-1.5">
                        <dt className="text-white/40">SKU</dt>
                        <dd>{it.sku}</dd>
                      </div>
                    )}
                  </dl>

                  {/* Inline, so staff can answer the phone without opening the print view. */}
                  {mto && (
                    <div className="mt-2 border border-white/10 p-2.5">
                      <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-white/40">
                        Measurements{it.measureUnit ? ` (${it.measureUnit})` : ""}
                      </p>
                      {Object.keys(it.measurements ?? {}).length === 0 ? (
                        <p className="text-xs text-white/40">None recorded.</p>
                      ) : (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                          {Object.entries(it.measurements ?? {}).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <dt className="text-white/40">{measureLabel(k)}</dt>
                              <dd dir="ltr">{v}{it.measureUnit}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {it.notes && <p className="mt-2 text-xs text-white/60">Note: {it.notes}</p>}
                      {it.leadMinDays != null && it.leadMaxDays != null && (
                        <p className="mt-1 text-[11px] text-white/40">
                          Promised in {it.leadMinDays}–{it.leadMaxDays} days
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="self-center text-sm">{formatMoney(it.price * it.quantity, "QAR")}</div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-white/10 px-5 py-4 text-sm">
          <Row label="Subtotal" value={formatMoney(order.subtotal, "QAR")} />
          {order.discount > 0 && <Row label="Discount" value={`− ${formatMoney(order.discount, "QAR")}`} />}
          <Row label="Shipping" value={order.shipping > 0 ? formatMoney(order.shipping, "QAR") : "Free"} />
          {order.tax > 0 && <Row label="Tax" value={formatMoney(order.tax, "QAR")} />}
          <Row label="Total" value={formatMoney(order.total, "QAR")} bold />
          {order.trackingNumber && <Row label="Tracking" value={order.trackingNumber} />}
        </div>

        <div className="space-y-1 border-t border-white/10 px-5 py-4 text-sm">
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-white/40">Payment</p>
          <Row label="Provider" value={order.paymentProvider ? order.paymentProvider.toUpperCase() : "—"} />
          {order.paymentRef && <Row label="Reference" value={order.paymentRef} />}
          {order.paidAt && <Row label="Paid at" value={order.paidAt.toLocaleString("en-US")} />}
        </div>

        {addr && (
          <div className="border-t border-white/10 px-5 py-4 text-sm text-white/60">
            <p className="mb-1 font-medium text-[#ececec]">{addr.fullName}</p>
            <p>{addr.address}{addr.address2 ? `, ${addr.address2}` : ""}</p>
            <p>{addr.city}, {addr.country}</p>
            <p>{addr.phone}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold" : "text-white/50"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
