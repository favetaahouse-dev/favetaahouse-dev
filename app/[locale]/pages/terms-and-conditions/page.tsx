import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PolicyPage } from "@/components/pages/PolicyPage";
import { TERMS } from "@/lib/pages-content";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PolicyPage title="TERMS AND CONDITIONS" sections={TERMS} />;
}
