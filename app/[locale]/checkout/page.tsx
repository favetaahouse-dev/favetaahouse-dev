import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
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
      {/* The form is prefilled from the session, so it streams in behind the heading. */}
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <CheckoutBody locale={locale} />
      </Suspense>
    </div>
  );
}

async function CheckoutBody({ locale }: { locale: string }) {
  const session = await auth().catch(() => null);
  const commerce = await getCommerceSettings();

  return (
    <CheckoutForm
      userEmail={session?.user?.email ?? undefined}
      shippingFee={commerce.shippingFee}
      freeShippingThreshold={commerce.freeShippingThreshold}
      taxRate={commerce.taxRate}
      taxLabel={locale === "ar" ? commerce.taxLabelAr : commerce.taxLabel}
    />
  );
}
