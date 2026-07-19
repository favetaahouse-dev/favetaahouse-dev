import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { fontVars } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin — ALESSIA ABAYA",
  robots: { index: false, follow: false },
};

/**
 * The admin panel's root layout. It is deliberately separate from the storefront's: the
 * storefront root lives at app/[locale] so it can read `lang`/`dir` from a static param,
 * which leaves /admin outside that segment and needing its own <html>.
 *
 * Admin is always English and never indexed. The session guard lives one level down in
 * (panel)/layout.tsx so /admin/login can render without one.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`h-full ${fontVars}`}>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <SessionProvider>
          {children}
          <Toaster position="bottom-center" toastOptions={{ style: { borderRadius: 0 } }} />
        </SessionProvider>
      </body>
    </html>
  );
}
