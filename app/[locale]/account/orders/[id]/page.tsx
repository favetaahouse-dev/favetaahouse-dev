import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { getOrder, getOrderItemHandles } from "@/lib/data/orders";
import { auth } from "@/lib/auth";
import { MetaPurchase } from "@/components/meta/MetaPurchase";
import { purchasePayload } from "@/lib/meta/events";
import { getCommerceSettings } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { icon } from "@/lib/icon";
import { variantLabel } from "@/lib/variant-options";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";

type Params = { locale: string; id: string };

/** A single shopper's order — nothing here is shared, so the whole body streams. */
export default function OrderPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-6 py-14" />}>
      <OrderContent params={params} />
    </Suspense>
  );
}

async function OrderContent({ params }: { params: Promise<Params> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const order = await getOrder(id);
  if (!order) notFound();
  // Ownership: a customer-owned order is visible only to that signed-in customer. Guest orders
  // (no user_id) stay reachable via their unguessable UUID for post-payment confirmation.
  if (order.userId) {
    const session = await auth().catch(() => null);
    if (session?.user?.id !== order.userId) notFound();
  }
  const t = await getTranslations("account");
  const commerce = await getCommerceSettings();
  const L = locale === "ar";
  const taxLabel = L ? commerce.taxLabelAr : commerce.taxLabel;
  const money = (c: number) => formatMoney(c, "QAR");

  const addr = order.shippingAddress as {
    fullName?: string;
    address?: string;
    address2?: string;
    city?: string;
    country?: string;
    phone?: string;
  } | null;

  const paid = order.status === "PAID" || order.status === "FULFILLED";

  /**
   * Meta Purchase fires only on a FRESH payment, not on every later visit to this page.
   *
   * The freshness comparison itself lives in <MetaPurchase>'s effect rather than here: reading
   * the clock during render is impure (a re-render could flip the answer), so the server hands
   * over `paidAtMs` and the client decides. Here we only gate the extra query on the order being
   * paid at all.
   */
  const handles = paid && order.paidAt ? await getOrderItemHandles(order.id) : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      {handles && order.paidAt && (
        <MetaPurchase
          orderId={order.id}
          paidAtMs={order.paidAt.getTime()}
          // Built here with the SAME builder the server-side event uses, so the two halves can
          // never report different money.
          payload={purchasePayload({
            lines: order.items.map((i) => ({
              handle: handles.get(i.id) ?? "",
              title: i.title,
              priceFils: i.price,
              quantity: i.quantity,
            })),
            totalFils: order.total,
          })}
        />
      )}
      {paid && (
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 {...icon.display} className="text-strong" />
          <h1 className="section-title">{t("orderPlaced")}</h1>
        </div>
      )}

      <div className="border border-line">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <p className="text-sm font-semibold">
              {t("order")} #{order.number}
            </p>
            <p className="text-xs text-muted">
              {order.createdAt.toLocaleDateString(locale === "ar" ? "ar" : "en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="divide-y divide-line px-6">
          {order.items.map((it) => (
            <div key={it.id} className="flex gap-4 py-4">
              <div className="relative aspect-[4/5] w-16 shrink-0 bg-mist">
                {it.imageUrl && <Image src={it.imageUrl} alt={it.title} fill sizes="64px" className="object-cover" />}
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-sm">{it.title}</p>
                <p className="text-xs text-muted">
                  {variantLabel(it)} · × {it.quantity}
                </p>
              </div>
              <div className="self-center text-sm">{formatMoney(it.price * it.quantity, "QAR")}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-line px-6 py-4 text-sm">
          <Row label={L ? "المجموع الفرعي" : "Subtotal"} value={money(order.subtotal)} />
          {order.discount > 0 && <Row label={L ? "الخصم" : "Discount"} value={`− ${money(order.discount)}`} />}
          <Row label={L ? "الشحن" : "Shipping"} value={order.shipping > 0 ? money(order.shipping) : L ? "مجاني" : "Free"} />
          {order.tax > 0 && <Row label={taxLabel} value={money(order.tax)} />}
          <Row label={t("total")} value={money(order.total)} bold />
          {order.trackingNumber && <Row label={t("tracking")} value={order.trackingNumber} />}
        </div>

        {addr && (
          <div className="border-t border-line px-6 py-4 text-sm text-muted">
            <p className="mb-1 font-medium text-ink">{addr.fullName}</p>
            <p>{addr.address}{addr.address2 ? `, ${addr.address2}` : ""}</p>
            <p>{addr.city}, {addr.country}</p>
            <p>{addr.phone}</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link href="/collections/all" className="btn-outline">
          {backLabel(locale)}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold" : "text-muted"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function backLabel(locale: string) {
  return locale === "ar" ? "العودة للتسوق" : "Continue Shopping";
}
