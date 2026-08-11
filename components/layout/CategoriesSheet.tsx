"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n-navigation";
import type { NavItem } from "@/lib/data/navigation";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/**
 * The bottom bar's Categories panel — a sheet that rises from the same edge the control
 * lives on, so the movement traces back to the thing you pressed.
 *
 * Two columns of plain type rather than image tiles: the categories are derived from live
 * catalogue data (lib/data/navigation.ts), so there is no guaranteed artwork behind each
 * one, and an empty tile reads far worse than a word.
 *
 * Slides on translate-y, which needs no RTL flip; the close affordances are the backdrop,
 * the X, and Escape.
 */
export function CategoriesSheet({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
}) {
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // The home link is a destination, not a category — it already has its own cell in the bar.
  const categories = navItems.filter((item) => item.href !== "/");

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
          "fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto bg-paper pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-500 ease-[cubic-bezier(0.24,0.25,0,1)] motion-reduce:transition-none",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto max-w-[720px] px-5 py-5">
          <div className="flex items-center justify-between">
            <span className="font-button text-[13px] font-medium tracking-[0.1em]">
              {tn("categories")}
            </span>
            <button
              onClick={onClose}
              aria-label={tc("close")}
              className="focus-ring -m-2 p-2 transition-opacity hover:opacity-60"
            >
              <X {...icon.action} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4">
            {categories.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-b border-line py-4 text-[14px] transition-colors hover:text-strong",
                    active ? "font-medium text-strong" : "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
