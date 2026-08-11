import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCommerceSettings } from "@/lib/content";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");

  return (
    <div className="min-h-[60vh]">
      <div className="px-4 pt-12 text-center md:px-8">
        <h1 className="section-title">{t("title")}</h1>
      </div>
      {/* Commerce settings (shipping/tax) are read server-side, so the form streams in behind the heading. */}
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <CheckoutBody locale={locale} />
      </Suspense>
    </div>
  );
}

async function CheckoutBody({ locale }: { locale: string }) {
  // Guard the settings read: a transient DB/streaming blip must not 500 the whole checkout
  // page (the intermittent digest 2532695733 "Connection closed"). Fall back to defaults.
  const commerce = await getCommerceSettings().catch(() => null);

  return (
    <CheckoutForm
      shippingFee={commerce?.shippingFee ?? 0}
      freeShippingThreshold={commerce?.freeShippingThreshold ?? 0}
      taxRate={commerce?.taxRate ?? 0}
      taxLabel={(locale === "ar" ? commerce?.taxLabelAr : commerce?.taxLabel) ?? "Tax"}
      settingsUnavailable={commerce === null}
    />
  );
}
