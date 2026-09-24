"use client";

import { useEffect, useId, useState } from "react";
import { X, Heart, User, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n-navigation";
import type { NavItem } from "@/lib/data/navigation";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/**
 * The nav drawer — the navigation below `lg`, where the header carries no row of links (from
 * `lg` the header's own Collections dropdown and About link replace it, and its hamburger goes).
 *
 * Home, About FAVETAA, then the Collections group; account, wishlist and language are pinned
 * to the foot. Collections is a disclosure rather than a flat run of links so the list reads the
 * same way it does in the header: the categories live inside it.
 */
export function MobileMenu({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: NavItem[];
}) {
  const ta = useTranslations("actions");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const listId = useId();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // Starts expanded when you are already inside one of the collections, so the page you are on
  // shows in the list instead of being folded away under its heading.
  const [collectionsOpen, setCollectionsOpen] = useState(() =>
    categories.some((c) => isActive(c.href)),
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const row = "block border-b border-line py-4 text-[15px] transition-colors hover:text-strong";

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
          // The hairline is the panel's edge: on black, a black panel over a dimmed black page
          // has no other way to show where it stops.
          "fixed start-0 top-0 z-50 flex h-full w-[86%] max-w-md flex-col border-e border-line bg-paper transition-transform duration-500 ease-[cubic-bezier(0.24,0.25,0,1)] motion-reduce:transition-none",
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
          <Link
            href="/"
            onClick={onClose}
            aria-current={pathname === "/" ? "page" : undefined}
            className={cn(row, pathname === "/" ? "font-medium text-strong" : "text-ink")}
          >
            {tn("home")}
          </Link>

          <Link
            href="/pages/about"
            onClick={onClose}
            aria-current={pathname === "/pages/about" ? "page" : undefined}
            className={cn(row, pathname === "/pages/about" ? "font-medium text-strong" : "text-ink")}
          >
            {tn("about")}
          </Link>

          {categories.length > 0 && (
            <div className="border-b border-line">
              <button
                type="button"
                aria-expanded={collectionsOpen}
                aria-controls={listId}
                onClick={() => setCollectionsOpen((o) => !o)}
                className="flex w-full items-center justify-between py-4 text-start text-[15px] text-ink transition-colors hover:text-strong aria-expanded:text-strong"
              >
                {tn("collections")}
                <ChevronDown
                  {...icon.inline}
                  aria-hidden
                  className={cn(
                    "transition-transform duration-300 ease-lux motion-reduce:transition-none",
                    collectionsOpen && "rotate-180",
                  )}
                />
              </button>
              {/* 0fr → 1fr animates to the list's real height with no measuring. The padding sits
                  on the <ul>, inside the clipping wrapper, so the collapsed state is a true zero;
                  `inert` keeps the folded links out of the tab order. */}
              <div
                id={listId}
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-lux motion-reduce:transition-none",
                  collectionsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden" inert={!collectionsOpen}>
                  <ul className="pb-3">
                    {categories.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "block py-2.5 ps-4 text-[14px] transition-colors hover:text-strong",
                              active ? "font-medium text-strong" : "text-ink",
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Pinned to the foot of the drawer, outside the scrolling list: the two personal
            destinations and the language switch are furniture, not catalogue, so they stay put
            however long the Collections list grows. */}
        <div className="border-t border-line px-6 pt-5 pb-4">
          <div className="flex flex-col gap-4 text-[14px] text-ink">
            <Link href="/account" onClick={onClose} className="flex items-center gap-3 hover:text-strong">
              <User {...icon.inline} /> {ta("account")}
            </Link>
            <Link href="/wishlist" onClick={onClose} className="flex items-center gap-3 hover:text-strong">
              <Heart {...icon.inline} /> {ta("wishlist")}
            </Link>
          </div>
          <LocaleSwitcher className="mt-5" />
        </div>
      </aside>
    </>
  );
}
