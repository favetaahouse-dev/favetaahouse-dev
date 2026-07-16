import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/admin-guard";
import { getOrder } from "@/lib/data/orders";
import { formatMoney } from "@/lib/money";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("orders:read");
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const addr = order.shippingAddress as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/orders" className="text-xs text-gold hover:underline">
        ← Orders
      </Link>
      <div className="mt-4 border border-white/10 bg-[#222320]">
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
          {order.items.map((it) => (
            <div key={it.id} className="flex gap-4 py-4">
              <div className="relative aspect-[4/5] w-14 shrink-0 bg-black/20">
                {it.imageUrl && <Image src={it.imageUrl} alt={it.title} fill sizes="56px" className="object-cover" />}
              </div>
              <div className="flex-1 text-sm">
                <p>{it.title}</p>
                <p className="text-xs text-white/40">{it.color} / {it.size} · × {it.quantity}</p>
              </div>
              <div className="self-center text-sm">{formatMoney(it.price * it.quantity, "QAR")}</div>
            </div>
          ))}
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
            <p className="mb-1 font-medium text-[#EDE9E6]">{addr.fullName}</p>
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
