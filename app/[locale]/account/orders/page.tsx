import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth, signOut } from "@/lib/auth";
import { Link } from "@/lib/i18n-navigation";
import { getUserOrders } from "@/lib/data/orders";
import { formatMoney } from "@/lib/money";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";

export const metadata: Metadata = { title: "My Account" };

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/account/login`);

  const orders = await getUserOrders(session.user.id);
  const t = await getTranslations("account");

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl tracking-[0.06em]">{t("title")}</h1>
          <p className="text-sm text-muted">{session.user.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/${locale}` });
          }}
        >
          <button className="btn-outline px-5 py-2 text-[11px]">{t("signOut")}</button>
        </form>
      </div>

      <h2 className="mb-4 font-button text-sm uppercase tracking-[0.16em]">{t("orders")}</h2>
      {orders.length === 0 ? (
        <div className="border border-line px-6 py-16 text-center">
          <p className="text-sm text-muted">{t("noOrders")}</p>
          <Link href="/collections/all" className="btn-brand mt-6 inline-flex">
            {t("orders")}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-line border border-line">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-cream"
            >
              <div>
                <p className="text-sm font-medium">
                  {t("order")} #{o.number}
                </p>
                <p className="text-xs text-muted">
                  {o.createdAt.toLocaleDateString(locale === "ar" ? "ar" : "en-US")} · {o.items.length} items
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm">{formatMoney(o.total, "QAR")}</span>
                <OrderStatusBadge status={o.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
