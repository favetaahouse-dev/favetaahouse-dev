import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PolicyPage } from "@/components/pages/PolicyPage";
import { TERMS, TERMS_AR } from "@/lib/pages-content";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  return (
    <PolicyPage
      title={ar ? "الشروط والأحكام" : "TERMS AND CONDITIONS"}
      updated={ar ? "تاريخ السريان: 23 يوليو 2026" : "Effective 23 July 2026"}
      sections={ar ? TERMS_AR : TERMS}
    />
  );
}
