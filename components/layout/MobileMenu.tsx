"use client";

import { useEffect } from "react";
import { X, Heart, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n-navigation";
import type { NavItem } from "@/lib/data/navigation";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/**
 * The nav drawer. Since the header no longer carries a row of links, this is where the
 * full navigation lives — at every width, not just on phones, which is why the old
 * `lg:hidden` is gone and the panel is wide enough to hold a desktop-length list.
 */
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
  const tc = useTranslations("common");
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-hidden={!open}
        className={cn(
          "fixed start-0 top-0 z-50 flex h-full w-[86%] max-w-md flex-col bg-paper transition-transform duration-500 ease-[cubic-bezier(0.24,0.25,0,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <span className="font-button text-[13px] font-medium tracking-[0.1em]">{ta("menu")}</span>
          <button
            onClick={onClose}
            aria-label={tc("close")}
            className="focus-ring -m-2 p-2 transition-opacity duration-300 hover:opacity-60"
          >
            <X {...icon.action} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-b border-line py-4 text-[15px] transition-colors hover:text-strong",
                  active || item.highlight ? "font-medium text-strong" : "text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {/* The two personal destinations, set apart from the catalogue above them. */}
          <div className="mt-6 flex flex-col gap-4 text-[14px] text-ink">
            <Link href="/account" onClick={onClose} className="flex items-center gap-3 hover:text-strong">
              <User {...icon.inline} /> {ta("account")}
            </Link>
            <Link href="/wishlist" onClick={onClose} className="flex items-center gap-3 hover:text-strong">
              <Heart {...icon.inline} /> {ta("wishlist")}
            </Link>
          </div>
        </nav>

        <div className="border-t border-line px-6 py-4">
          <LocaleSwitcher />
        </div>
      </aside>
    </>
  );
}
