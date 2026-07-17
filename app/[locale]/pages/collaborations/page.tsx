import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { COLLAB_LINKS } from "@/lib/pages-content";
import { getSiteSettings } from "@/lib/content";

/** "https://www.instagram.com/alessia_abaya/" -> "@alessia_abaya" */
function instagramHandle(url: string): string {
  const slug = url.replace(/\/+$/, "").split("/").pop();
  return slug ? `@${slug}` : url;
}

export const metadata: Metadata = { title: "Collaborations" };

export default async function CollaborationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { contactEmail, instagram } = await getSiteSettings();

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="section-title mb-8">COLLABORATIONS</h1>
      <p className="text-center text-[15px] leading-relaxed text-ink/80">
        📩 Interested in collaborating? Let&apos;s create something beautiful together.
      </p>
      <p className="mt-4 text-center text-[15px] text-ink/80">
        Email us at:{" "}
        <a href={`mailto:${contactEmail}`} className="text-gold hover:underline">
          {contactEmail}
        </a>{" "}
        or DM us on Instagram:{" "}
        <a href={instagram} target="_blank" rel="noopener" className="text-gold hover:underline">
          {instagramHandle(instagram)}
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
