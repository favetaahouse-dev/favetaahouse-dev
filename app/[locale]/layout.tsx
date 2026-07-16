import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getCart } from "@/lib/data/cart";
import { getNavItems } from "@/lib/data/navigation";
import { Providers } from "@/components/providers/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsappButton } from "@/components/layout/WhatsappButton";
import { CurrencySwitcher } from "@/components/layout/CurrencySwitcher";
import { CartDrawer } from "@/components/cart/CartDrawer";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
  const cart = await getCart();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Providers initialCart={cart}>
        <Header navItems={navItems} />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsappButton />
        <CurrencySwitcher />
        <CartDrawer />
      </Providers>
    </NextIntlClientProvider>
  );
}
