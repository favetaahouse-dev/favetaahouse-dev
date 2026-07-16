import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { DirSync } from "@/components/DirSync";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ALESSIA ABAYA — Elevated Modest Fashion",
    template: "%s | ALESSIA ABAYA",
  },
  description:
    "ALESSIA ABAYA — a Qatari house of timeless elegance. Luxury abayas and jalabiyas crafted from exclusive fabrics since 1982.",
  icons: { icon: "/assets/files/64_x_64-q52d30e4f.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale().catch(() => "en");
  const messages = await getMessages().catch(() => ({}));
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className="h-full">
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <DirSync />
            {children}
            <Toaster position="bottom-center" toastOptions={{ style: { borderRadius: 0 } }} />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
