import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";
import { getNavItems } from "@/lib/data/navigation";
import { getHomeMedia, getSiteSettings } from "@/lib/content";
import { DirSync } from "@/components/DirSync";
import { Providers } from "@/components/providers/Providers";
import { NavUIProvider } from "@/components/providers/nav-ui-context";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { BottomBar } from "@/components/layout/BottomBar";
import { Footer } from "@/components/layout/Footer";
import { WhatsappButton } from "@/components/layout/WhatsappButton";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { CartDrawerMount } from "@/components/cart/CartDrawerMount";
import { CartHydrator } from "@/components/cart/CartHydrator";
import { MetaPixel } from "@/components/meta/MetaPixel";
import { fontVars } from "@/lib/fonts";
import "../globals.css";

/**
 * Static, so it stays in the prerendered shell — generateViewport only defers to request time
 * if it reads runtime data (next/dist/docs/.../functions/generate-viewport.md).
 *
 * viewport-fit=cover lets the full-bleed hero image run under the status bar / dynamic island
 * instead of being letterboxed inside a white strip. It is also what makes
 * env(safe-area-inset-*) non-zero at all: without this line every inset in globals.css,
 * AnnouncementBar and the floating buttons resolves to 0px and is inert.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Cream, matching --color-paper. The browser paints this behind the page and into the
  // mobile status bar, so leaving it white put a hard white strip above a cream document.
  themeColor: "#f6f2ea",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "FAVETAA — Elevated Modest Fashion",
    template: "%s | FAVETAA",
  },
  description:
    "FAVETAA — a Qatari house of timeless elegance. Luxury abayas and jalabiyas crafted from exclusive fabrics.",
  // The lockup on paper, not the mark on black: every platform re-encodes and crops these,
  // and the supplied wordmark is a deep oxblood that disappears on a dark ground. A light
  // card also matches the storefront the link actually opens.
  openGraph: {
    type: "website",
    siteName: "FAVETAA",
    title: "FAVETAA — Elevated Modest Fashion",
    description:
      "A Qatari house of timeless elegance. Luxury abayas and jalabiyas crafted from exclusive fabrics.",
    images: [{ url: "/assets/brand/opengraph-image.png", width: 1200, height: 630, alt: "FAVETAA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAVETAA — Elevated Modest Fashion",
    images: ["/assets/brand/opengraph-image.png"],
  },
  // Site chrome stays in public/; only product media lives in Supabase Storage.
  // This .png is the source of truth, and serves the high-res icon (bookmarks, home
  // screens) that the 48px-max app/favicon.ico cannot. That .ico is file-based metadata,
  // which Next ranks ABOVE this entry — so after changing the .png run `npm run favicon`
  // to regenerate it, or the stale .ico silently keeps winning in the tab.
  icons: { icon: "/assets/brand/favicon.png" },
  // Meta domain verification, needed for Aggregated Event Measurement (iOS). Conditional on
  // purpose: an unconditional entry renders content="undefined", which Meta reads as a FAILED
  // verification rather than an absent one. Preferred method is a DNS TXT record — it survives
  // deploys and needs no env var — so this stays empty unless the owner opts for the meta tag.
  ...(process.env.META_DOMAIN_VERIFICATION
    ? { other: { "facebook-domain-verification": process.env.META_DOMAIN_VERIFICATION } }
    : {}),
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The storefront's root layout — it owns <html> so that `lang`/`dir` come from the route's
 * own static param. A shared root above this segment would have to resolve the locale from
 * the request instead, and that one runtime read was enough to force every page in the app
 * to render on demand. `/admin` has its own root layout for the same reason.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages =
    locale === "ar"
      ? (await import("@/messages/ar.json")).default
      : (await import("@/messages/en.json")).default;
  const navItems = await getNavItems(locale);

  // The admin-editable storefront announcement bar (Admin → Announcements). Cached under the
  // "content" tag like the footer/nav, so it stays in the prerendered shell and a save
  // (revalidateTag "content") makes it appear live. Fall back to the other language so a
  // single-language message still shows; blank both to hide the bar entirely.
  const settings = await getSiteSettings();
  const announcement = (
    (locale === "ar"
      ? settings.announcement_ar || settings.announcement
      : settings.announcement || settings.announcement_ar) || ""
  ).trim();
  const announcementActive = announcement.length > 0;

  // Whether the homepage currently HAS a hero to sit over. The header combines this with its own
  // pathname check, so removing the video in the admin also takes the transparent treatment away
  // rather than leaving a white wordmark on a white band. Same "content" tag as the settings
  // above, so it costs no extra round trip on a warm cache.
  const heroOverlay = (await getHomeMedia()) !== null;

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`h-full ${fontVars}`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        {/* No `session` prop: fetching it needs cookies(), which would pull the whole
            shell out of the prerender. Anonymous visitors — nearly all of them — get one
            background /api/auth/session call after hydration instead. */}
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <DirSync />
            <Providers>
              {/* The header and the bottom bar sit at opposite edges and open the same three
                  panels, so the panels are owned here — one mounted instance each, and one
                  answer to "which is showing". */}
              <NavUIProvider navItems={navItems}>
                {/* In normal flow at the very top so it scrolls away; the fixed header offsets
                    itself below it. Renders nothing when no message is set. */}
                <AnnouncementBar text={announcement} />
                {/* The header goes transparent only on "/", so it reads the pathname — runtime
                    data on routes with an un-enumerated param. On the prerendered routes
                    (including "/") this resolves inline into the shell and the fallback never
                    paints. Where it does paint it is an in-flow spacer with NO background: the
                    old `fixed … bg-paper` flashed a solid white bar across the top of
                    the hero, and being fixed it reserved no space either, so content
                    jumped when the real header arrived. */}
                <Suspense fallback={<div aria-hidden className="h-[60px] md:h-[72px]" />}>
                  <Header announcementActive={announcementActive} heroOverlay={heroOverlay} />
                </Suspense>
                <main className="flex-1">{children}</main>
                {/* Both read CMS site settings and sit below the fold, so they stream in
                    rather than holding up the shell. */}
                <Suspense fallback={<div className="h-96" />}>
                  <Footer />
                </Suspense>
                {/* Reads the pathname for its active cell — same reason as the header. */}
                <Suspense fallback={<div aria-hidden className="h-[61px]" />}>
                  <BottomBar />
                </Suspense>
              </NavUIProvider>
              <Suspense fallback={null}>
                <WhatsappButton />
              </Suspense>
              <CurrencySwitcher />
              <CartDrawerMount />
              {/* The only per-visitor read on the page; streams in so the rest prerenders. */}
              <Suspense fallback={null}>
                <CartHydrator />
              </Suspense>
            </Providers>
            {/* Meta Pixel — storefront only. app/admin has its own <html> and stays untracked, so
                the owner's own admin sessions never enter their retargeting audiences. Renders
                nothing and reads no cookies server-side, so the static shell is unaffected. */}
            <MetaPixel />
            {/* Offset so toasts land above the fixed bottom bar rather than behind it. */}
            <Toaster
              position="bottom-center"
              offset={72}
              toastOptions={{ style: { borderRadius: "var(--radius-control)" } }}
            />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
