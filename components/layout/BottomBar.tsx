"use client";

import { House, LayoutGrid, Search, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n-navigation";
import { useCart } from "@/components/providers/cart-context";
import { useNavUI } from "@/components/providers/nav-ui-context";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/**
 * The persistent bottom app bar — the storefront's primary navigation at every width.
 *
 * Four destinations, thumb-height, always on screen: it replaces the row of header links
 * so the top of the page can be nothing but the wordmark. Height is fixed at 61px and
 * published as --bottom-bar-h in globals.css, because three other things have to clear
 * it (the page's own bottom padding, the floating currency/WhatsApp buttons, the toasts)
 * and they should all read one number.
 *
 * z-30 puts it under the drawers (z-50) it opens, so the cart or the menu covers it
 * rather than fighting it.
 */
export function BottomBar() {
  const ta = useTranslations("actions");
  const tn = useTranslations("nav");
  const pathname = usePathname();
  const { count, setOpen } = useCart();
  const { open, isOpen } = useNavUI();

  // 11px rather than 10 for the caption, and ink rather than muted at rest: this is the site's
  // primary navigation, and grey 10px type under a faint glyph was the least legible thing on
  // the page. 24px mark + 4px gap + one 11px line = 44px inside the 61px bar, so nothing needs
  // to grow to hold it.
  const cell =
    "focus-ring flex h-full flex-col items-center justify-center gap-1 text-[11px] tracking-[0.08em] text-ink transition-colors hover:text-strong aria-[current=page]:font-medium aria-[current=page]:text-strong aria-expanded:text-strong";

  return (
    <nav
      aria-label={ta("menu")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="mx-auto grid h-[61px] max-w-[720px] grid-cols-4">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={cell}>
          <House {...icon.nav} />
          {ta("home")}
        </Link>

        <button
          onClick={() => open("categories")}
          aria-expanded={isOpen("categories")}
          className={cell}
        >
          <LayoutGrid {...icon.nav} />
          {tn("categories")}
        </button>

        <button onClick={() => open("search")} aria-expanded={isOpen("search")} className={cell}>
          <Search {...icon.nav} />
          {ta("search")}
        </button>

        <button
          onClick={() => setOpen(true)}
          aria-label={count > 0 ? `${ta("cart")}, ${count}` : undefined}
          className={cn(cell, "relative")}
        >
          <span className="relative">
            <ShoppingBag {...icon.nav} />
            {count > 0 && (
              <span className="absolute -end-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-strong px-1 text-[10px] font-medium leading-none text-white">
                {count}
              </span>
            )}
          </span>
          {ta("cart")}
        </button>
      </div>
    </nav>
  );
}
