import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PolicyPage } from "@/components/pages/PolicyPage";
import { getTerms } from "@/lib/pages-content";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "footer" });
  return { title: t("terms") };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("footer");
  return <PolicyPage title={t("terms")} sections={getTerms(locale)} />;
}
