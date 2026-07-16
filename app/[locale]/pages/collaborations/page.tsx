import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { COLLAB_LINKS } from "@/lib/pages-content";
import { CONTACT_EMAIL, SOCIALS } from "@/lib/constants";

export const metadata: Metadata = { title: "Collaborations" };

export default async function CollaborationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="section-title mb-8">COLLABORATIONS</h1>
      <p className="text-center text-[15px] leading-relaxed text-ink/80">
        📩 Interested in collaborating? Let&apos;s create something beautiful together.
      </p>
      <p className="mt-4 text-center text-[15px] text-ink/80">
        Email us at:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">
          {CONTACT_EMAIL}
        </a>{" "}
        or DM us on Instagram:{" "}
        <a href={SOCIALS.instagram} target="_blank" rel="noopener" className="text-gold hover:underline">
          @alessia_abaya
        </a>
      </p>

      <h2 className="mt-14 mb-5 text-center text-lg uppercase tracking-[0.14em]">As Seen In</h2>
      <ul className="mx-auto max-w-md space-y-2.5 text-center">
        {COLLAB_LINKS.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener" className="text-sm text-ink/75 hover:text-gold">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
