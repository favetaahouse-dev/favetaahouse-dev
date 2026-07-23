import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PolicyPage } from "@/components/pages/PolicyPage";
import { PRIVACY, PRIVACY_AR } from "@/lib/pages-content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ar = locale === "ar";
  return (
    <PolicyPage
      title={ar ? "سياسة الخصوصية" : "PRIVACY POLICY"}
      updated={ar ? "تاريخ السريان: 23 يوليو 2026" : "Effective 23 July 2026"}
      sections={ar ? PRIVACY_AR : PRIVACY}
    />
  );
}
