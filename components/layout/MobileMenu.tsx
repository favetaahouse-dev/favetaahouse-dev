"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import type { NavItem } from "@/lib/data/navigation";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { cn } from "@/lib/utils";

export function MobileMenu({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
}) {
  const ta = useTranslations("actions");

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed start-0 top-0 z-50 flex h-full w-[86%] max-w-sm flex-col bg-paper transition-transform duration-500 ease-[cubic-bezier(0.24,0.25,0,1)] lg:hidden",
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-button text-xs uppercase tracking-[0.2em]">{ta("menu")}</span>
          <button onClick={onClose} aria-label="Close">
            <X strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-2">
          {navItems.map((item) => (
            <div key={item.key} className="border-b border-line/60">
              <Link
                href={item.href}
                onClick={onClose}
                className={cn(
                  "block py-3.5 font-button text-[13px] uppercase tracking-[0.14em]",
                  item.highlight && "font-semibold text-signal",
                )}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <Link href="/account/login" onClick={onClose} className="block py-2 text-[13px] uppercase tracking-[0.14em]">
            {ta("login")}
          </Link>
          <div className="mt-2">
            <LocaleSwitcher />
          </div>
        </div>
      </aside>
    </>
  );
}
