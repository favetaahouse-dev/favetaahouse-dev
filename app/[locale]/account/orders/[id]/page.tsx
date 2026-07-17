import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { getOrder } from "@/lib/data/orders";
import { getCommerceSettings } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { variantLabel } from "@/lib/variant-options";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";

type Params = { locale: string; id: string };

export default async function OrderPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const order = await getOrder(id);
  if (!order) notFound();
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      {paid && (
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={48} className="text-gold" strokeWidth={1.2} />
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
              <div className="relative aspect-[4/5] w-16 shrink-0 bg-cream">
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
