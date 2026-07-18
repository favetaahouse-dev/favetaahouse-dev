import { Suspense } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";
import { getNavItems } from "@/lib/data/navigation";
import { DirSync } from "@/components/DirSync";
import { Providers } from "@/components/providers/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsappButton } from "@/components/layout/WhatsappButton";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartHydrator } from "@/components/cart/CartHydrator";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ALESSIA ABAYA — Elevated Modest Fashion",
    template: "%s | ALESSIA ABAYA",
  },
  description:
    "ALESSIA ABAYA — a Qatari house of timeless elegance. Luxury abayas and jalabiyas crafted from exclusive fabrics since 1982.",
  // Site chrome stays in public/; only product media lives in Supabase Storage.
  // This .png is the source of truth, and serves the high-res icon (bookmarks, home
  // screens) that the 48px-max app/favicon.ico cannot. That .ico is file-based metadata,
  // which Next ranks ABOVE this entry — so after changing the .png run `npm run favicon`
  // to regenerate it, or the stale .ico silently keeps winning in the tab.
  icons: { icon: "/assets/brand/favicon.png" },
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

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="h-full">
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <DirSync />
            <Providers>
              {/* The header goes transparent only on "/", so it reads the pathname — runtime
                  data on routes with an un-enumerated param. The fallback is the solid bar
                  it would render there anyway, and since the header is fixed, nothing below
                  it shifts. On the prerendered routes this resolves inline into the shell. */}
              <Suspense fallback={<div className="fixed inset-x-0 top-0 z-40 h-[84px] bg-paper" />}>
                <Header navItems={navItems} />
              </Suspense>
              <main className="flex-1">{children}</main>
              {/* Both read CMS site settings and sit below the fold, so they stream in
                  rather than holding up the shell. */}
              <Suspense fallback={<div className="h-96" />}>
                <Footer />
              </Suspense>
              <Suspense fallback={null}>
                <WhatsappButton />
              </Suspense>
              <CurrencySwitcher />
              <CartDrawer />
              {/* The only per-visitor read on the page; streams in so the rest prerenders. */}
              <Suspense fallback={null}>
                <CartHydrator />
              </Suspense>
            </Providers>
            <Toaster position="bottom-center" toastOptions={{ style: { borderRadius: 0 } }} />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
