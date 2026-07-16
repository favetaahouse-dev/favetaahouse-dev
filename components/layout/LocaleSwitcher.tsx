"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n-navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={cn("flex items-center gap-2 font-button text-[11px] uppercase tracking-[0.14em]", className)}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <span className="opacity-40">/</span>}
          <button
            onClick={() => router.replace(pathname, { locale: l })}
            className={cn("transition-opacity hover:opacity-100", l === locale ? "opacity-100 underline" : "opacity-60")}
          >
            {l === "ar" ? "العربية" : "English"}
          </button>
        </span>
      ))}
    </div>
  );
}
