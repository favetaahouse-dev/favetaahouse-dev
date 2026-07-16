"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, ShoppingBag, Menu, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n-navigation";
import type { NavItem } from "@/lib/data/navigation";
import { useCart } from "@/components/providers/cart-context";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { SearchDrawer } from "@/components/layout/SearchDrawer";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { cn } from "@/lib/utils";

export function Header({ navItems }: { navItems: NavItem[] }) {
  const ta = useTranslations("actions");
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { count, setOpen } = useCart();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const light = isHome && !scrolled;

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
          light ? "bg-transparent text-white" : "bg-paper text-ink shadow-[0_1px_0_rgba(0,0,0,0.06)]",
        )}
        onMouseLeave={() => {}}
      >
        <div className="mx-auto flex h-[84px] max-w-[1600px] items-center justify-between gap-4 px-4 md:px-8">
          {/* left: hamburger (mobile) / nav (desktop) */}
          <div className="flex flex-1 items-center gap-6">
            <button
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={ta("menu")}
            >
              <Menu strokeWidth={1.4} />
            </button>
            <Link href="/" className="relative block h-10 w-[80px] shrink-0 lg:hidden">
              <Logo light={light} />
            </Link>
          </div>

          {/* center: logo (desktop) */}
          <Link href="/" className="relative hidden h-14 w-[120px] shrink-0 lg:block">
            <Logo light={light} />
          </Link>

          {/* right: icons */}
          <div className="flex flex-1 items-center justify-end gap-4">
            <button onClick={() => setSearchOpen(true)} aria-label={ta("search")}>
              <Search size={19} strokeWidth={1.4} />
            </button>
            <Link href="/wishlist" aria-label={ta("wishlist")} className="hidden sm:block">
              <Heart size={19} strokeWidth={1.4} />
            </Link>
            <AccountMenu />
            <button onClick={() => setOpen(true)} aria-label={ta("cart")} className="relative">
              <ShoppingBag size={19} strokeWidth={1.4} />
              {count > 0 && (
                <span className="absolute -end-2 -top-2 flex h-4 min-w-4 items-center justify-center bg-ink px-1 text-[10px] font-medium text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* desktop nav row */}
        <nav className="hidden border-t border-white/10 lg:block">
          <ul
            className={cn(
              "mx-auto flex max-w-[1600px] items-center justify-center gap-8 px-8 py-3 font-button text-[11px] uppercase tracking-[0.16em]",
              light ? "border-white/10" : "text-ink",
            )}
          >
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    "py-1 transition-colors hover:text-gold",
                    item.highlight && "font-semibold text-sale",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* spacer so content clears the fixed header on non-home pages */}
      {!isHome && <div className="h-[84px] lg:h-[132px]" />}

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} navItems={navItems} />
      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function Logo({ light }: { light: boolean }) {
  return (
    <Image
      src={light ? "/assets/brand/logo-white.png" : "/assets/brand/logo-dark.png"}
      alt="ALESSIA ABAYA"
      fill
      priority
      sizes="120px"
      className="object-contain object-center"
    />
  );
}
