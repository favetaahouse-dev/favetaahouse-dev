import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PolicyPage } from "@/components/pages/PolicyPage";
import { PRIVACY } from "@/lib/pages-content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PolicyPage title="PRIVACY POLICY" sections={PRIVACY} />;
}
