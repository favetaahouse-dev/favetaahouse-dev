import { Suspense } from "react";
import Image from "next/image";
import { cacheLife } from "next/cache";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/lib/i18n-navigation";
import { PAYMENT_ICONS } from "@/lib/constants";
import { getSiteSettings } from "@/lib/content";
import { getNavItems } from "@/lib/data/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { InstagramIcon, FacebookIcon, YoutubeIcon, TiktokIcon, WhatsAppIcon } from "@/components/icons/social";

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

/**
 * A centred burgundy footer, in two bands: the main slab carries the lockup, the links and
 * the socials, and a deeper band under it carries the legal row. The step between the two
 * is what stops a full-width dark red from reading as one undifferentiated wall.
 *
 * Everything here paints on burgundy, so it uses the footer-* scale from globals.css —
 * NOT text-ink / text-muted / border-line, which are tuned for the cream page and
 * disappear against this surface. Champagne is the only accent, used at hover and on the
 * tagline; the three link columns are gone because the catalogue is already reachable from
 * the bottom bar and the drawer on every screen.
 */
export async function Footer() {
  const t = await getTranslations("footer");
  const locale = await getLocale();
  const year = await copyrightYear();
  const settings = await getSiteSettings();
  // Mirror the header navigation so the footer stays in sync as categories/collections change.
  const navItems = await getNavItems(locale);

  // Blanking a social in the admin should hide its icon, not render href="".
  const socials = [
    { key: "instagram", label: "Instagram", url: settings.instagram, Icon: InstagramIcon },
    { key: "facebook", label: "Facebook", url: settings.facebook, Icon: FacebookIcon },
    { key: "youtube", label: "YouTube", url: settings.youtube, Icon: YoutubeIcon },
    { key: "tiktok", label: "TikTok", url: settings.tiktok, Icon: TiktokIcon },
    {
      key: "whatsapp",
      label: "WhatsApp",
      url: settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}` : "",
      Icon: WhatsAppIcon,
    },
  ].filter((s) => s.url);

  const links = [
    ...navItems.map((n) => ({ label: n.label, href: n.href })),
    { label: t("terms"), href: "/pages/terms-and-conditions" },
    { label: t("privacy"), href: "/pages/privacy-policy" },
  ];

  return (
    <footer className="site-footer mt-20 bg-footer text-footer-fg">
      <div className="mx-auto max-w-[1200px] px-6 py-14 text-center">
        {/* The full lockup — mark above the FAVETAA wordmark — because the footer is the one
            place with the vertical room the header lacks.
            The -light cut, not the master: the supplied wordmark is oxblood, which on this
            burgundy slab is dark-on-dark and all but vanishes. Only the wordmark is repainted
            to --color-footer-fg; the gold mark is untouched, so the two files cannot drift in
            anything but that one deliberate respect. logo-lockup.png stays the master for
            pale grounds (the OG card).
            aspect-[480/339] mirrors the asset's real ratio, so the box cannot crush it the way
            the old landscape wordmark slot would have. */}
        <div className="relative mx-auto aspect-[480/339] w-[168px] md:w-[200px]">
          {/* eager + low, and the pair is the point.
              `eager` because on a SHORT page — an empty collection, a policy page, the login
              form, a 404 — the whole document fits the viewport and this lockup becomes the
              Largest Contentful Paint; lazy then delays it by a full round trip, which is
              the warning Next logs for /ar/collections/liberty.
              `fetchPriority="low"` because eager ALONE makes Next hoist a
              <link rel="preload" as="image"> into <head> (verified in the rendered HTML),
              and a footer mark preloaded ahead of the product photography on every long page
              is the opposite trade. The Image docs list fetchPriority as one of the two props
              that suppress that preload, so together they say the honest thing: do not defer
              this, but it is never the urgent request on a page that has real imagery. */}
          <Image
            src="/assets/brand/logo-lockup-light.png"
            alt="FAVETAA"
            fill
            loading="eager"
            fetchPriority="low"
            sizes="200px"
            className="object-contain object-center"
          />
        </div>
        <p className="eyebrow mt-3">{t("tagline")}</p>

        <nav className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className="text-[13px] text-footer-link transition-colors hover:text-footer-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* gap-2 + p-2 rather than gap-5 and no padding: the marks keep the same 16px of air
            between them, but each link is now a 38px target instead of a 22px glyph. */}
        {socials.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {socials.map(({ key, label, url, Icon }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener"
                aria-label={label}
                className="focus-ring p-2 text-footer-link transition-colors hover:text-footer-accent"
              >
                <Icon />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* The legal band steps down to --color-footer-deep. It is the whole reason the footer
          stops reading as one flat sheet of red: the eye gets a horizontal edge to land on,
          and the champagne hairline sitting on that edge does the work the old cream
          border-line was doing far too loudly. */}
      <div className="border-t border-footer-line bg-footer-deep">
        {/* The bottom bar is fixed over this edge, so the last row buys itself clearance —
            without it the copyright line sits permanently underneath the bar. */}
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-5 pb-[calc(1.25rem+var(--bottom-bar-clear))] md:flex-row">
          {/* Needs the current pathname to switch locale in place, which is runtime data on
              routes whose params aren't enumerated. Suspending just this control keeps the
              rest of the footer in the static shell. */}
          <Suspense fallback={<div className="h-4" />}>
            <LocaleSwitcher />
          </Suspense>
          {/* Every card mark is natively 38×24 and already draws its own white card with a
              hairline border, so the old h-6/w-9 wrapper was a 36px-wide box with 8px of
              padding holding a 38px-wide asset: the artwork was scaled to ~28px and the
              numerals inside it went to mush. Rendered at 1.16× its native size on its own
              aspect ratio instead — no wrapper to fight, no re-scaling, no blur. */}
          <div className="flex items-center gap-2">
            {PAYMENT_ICONS.map((p) => (
              <Image
                key={p.name}
                src={p.src}
                alt={p.name}
                width={44}
                height={28}
                className="h-7 w-auto"
              />
            ))}
          </div>
          <p className="text-[11px] text-footer-muted">{t("rights", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
