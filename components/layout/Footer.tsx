import { Suspense } from "react";
import Image from "next/image";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { PAYMENT_ICONS } from "@/lib/constants";
import { getSiteSettings } from "@/lib/content";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { InstagramIcon, FacebookIcon, YoutubeIcon, TiktokIcon } from "@/components/icons/social";

/**
 * Cached rather than read inline: the copyright year is identical for every visitor and
 * changes once a year, and reading the clock during prerendering is exactly what Cache
 * Components rejects — it would otherwise pin the footer, and so the whole site, to
 * request-time rendering.
 */
async function copyrightYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function Footer() {
  const t = await getTranslations("footer");
  const year = await copyrightYear();
  const settings = await getSiteSettings();

  // Blanking a social in the admin should hide its icon, not render href="".
  const socials = [
    { key: "instagram", label: "Instagram", url: settings.instagram, Icon: InstagramIcon },
    { key: "facebook", label: "Facebook", url: settings.facebook, Icon: FacebookIcon },
    { key: "youtube", label: "YouTube", url: settings.youtube, Icon: YoutubeIcon },
    { key: "tiktok", label: "TikTok", url: settings.tiktok, Icon: TiktokIcon },
  ].filter((s) => s.url);

  const cols = [
    {
      title: t("shop"),
      links: [
        { label: t("home"), href: "/" },
        { label: t("shop"), href: "/collections/all" },
        { label: t("contact"), href: "/pages/contact" },
      ],
    },
    {
      title: t("policies"),
      links: [
        { label: t("terms"), href: "/pages/terms-and-conditions" },
        { label: t("privacy"), href: "/pages/privacy-policy" },
      ],
    },
  ];

  return (
    <footer className="mt-20 bg-footer text-footer-fg">
      <div className="mx-auto max-w-[1400px] border-b border-white/10 px-6 py-14 text-center">
        <p className="display text-3xl tracking-[0.14em] md:text-[2.75rem]">ALESSIA ABAYA</p>
        <p className="eyebrow mt-3.5 text-footer-fg/55">{t("tagline")}</p>
      </div>
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-10 px-6 py-14 md:grid-cols-3">
        {cols.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 font-button text-[11px] uppercase tracking-[0.2em]">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-footer-fg/75 transition-colors hover:text-footer-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="mb-4 font-button text-[11px] uppercase tracking-[0.2em]">{t("followUs")}</h3>
          <div className="flex items-center gap-4">
            {socials.map(({ key, label, url, Icon }) => (
              <a key={key} href={url} target="_blank" rel="noopener" aria-label={label} className="hover:text-signal">
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-5 md:flex-row">
          {/* Needs the current pathname to switch locale in place, which is runtime data on
              routes whose params aren't enumerated. Suspending just this control keeps the
              rest of the footer in the static shell. */}
          <Suspense fallback={<div className="h-4" />}>
            <LocaleSwitcher />
          </Suspense>
          <div className="flex items-center gap-2.5">
            {PAYMENT_ICONS.map((p) => (
              <span key={p.name} className="flex h-6 w-9 items-center justify-center bg-white/95 px-1">
                <Image src={p.src} alt={p.name} width={30} height={20} className="h-auto w-auto object-contain" />
              </span>
            ))}
          </div>
          <p className="text-[11px] text-footer-fg/60">{t("rights", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
