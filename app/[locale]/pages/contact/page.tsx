import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/pages/ContactForm";
import { CONTACT_EMAIL, STORE_LOCATION } from "@/lib/constants";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="section-title mb-4">{t("title")}</h1>
      <p className="mx-auto mb-10 max-w-lg text-center text-sm leading-relaxed text-ink/70">
        {t("intro")}
      </p>
      <ContactForm />
      <div className="mt-12 text-center text-sm text-muted">
        <p>{CONTACT_EMAIL}</p>
        <p className="mt-1">{STORE_LOCATION}</p>
      </div>
    </div>
  );
}
