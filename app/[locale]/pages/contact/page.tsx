import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/pages/ContactForm";
import { getContent, getSiteSettings, getWhatsappUrl } from "@/lib/content";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Heading and intro come from the CMS (Admin → Content → Contact) — they used to render
  // from messages/*.json, which left that editor saving into the void. The form's own field
  // labels stay in messages. Locale is resolved here so the client form gets one plain string.
  const c = await getContent("contact");
  const { contactEmail, storeLocation } = await getSiteSettings();
  const ar = locale === "ar";

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="section-title mb-4">{ar ? c.title_ar : c.title}</h1>
      <p className="mx-auto mb-10 max-w-lg text-center text-sm leading-relaxed text-ink/70">
        {ar ? c.intro_ar : c.intro}
      </p>
      <ContactForm whatsappUrl={await getWhatsappUrl()} />
      <div className="mt-12 text-center text-sm text-muted">
        {contactEmail && (
          <p>
            <a href={`mailto:${contactEmail}`} className="hover:text-gold">
              {contactEmail}
            </a>
          </p>
        )}
        {storeLocation && <p className="mt-1">{storeLocation}</p>}
      </div>
    </div>
  );
}
