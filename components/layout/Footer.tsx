import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { SOCIALS, PAYMENT_ICONS } from "@/lib/constants";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { InstagramIcon, FacebookIcon, YoutubeIcon, TiktokIcon } from "@/components/icons/social";

export async function Footer() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  const cols = [
    { title: t("menu"), links: [{ label: t("search"), href: "/search" }] },
    {
      title: t("shop"),
      links: [
        { label: t("home"), href: "/" },
        { label: t("shop"), href: "/collections/all" },
        { label: t("ourStory"), href: "/pages/about-us" },
        { label: t("materials"), href: "/pages/materials-colors" },
        { label: t("contact"), href: "/pages/contact" },
        { label: t("collaborations"), href: "/pages/collaborations" },
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
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-10 px-6 py-14 md:grid-cols-4">
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
            <a href={SOCIALS.instagram} target="_blank" rel="noopener" aria-label="Instagram" className="hover:text-gold">
              <InstagramIcon />
            </a>
            <a href={SOCIALS.facebook} target="_blank" rel="noopener" aria-label="Facebook" className="hover:text-gold">
              <FacebookIcon />
            </a>
            <a href={SOCIALS.youtube} target="_blank" rel="noopener" aria-label="YouTube" className="hover:text-gold">
              <YoutubeIcon />
            </a>
            <a href={SOCIALS.tiktok} target="_blank" rel="noopener" aria-label="TikTok" className="hover:text-gold">
              <TiktokIcon />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-5 md:flex-row">
          <LocaleSwitcher />
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
