"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, ShoppingBag, Menu, Heart, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n-navigation";
import { useCart } from "@/components/providers/cart-context";
import { useNavUI } from "@/components/providers/nav-ui-context";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

// The announcement bar's content-row height (AnnouncementBar). The fixed header starts this
// far down so it clears the in-flow bar, then slides to top:0 as the bar scrolls off-screen.
// Mirrored by .site-header--bar in app/globals.css, which does the actual arithmetic.
const BAR_H = 34;

/**
 * One header at every width: controls on the left, wordmark dead centre, account and bag on
 * the right. The navigation itself lives in the drawer and the bottom bar rather than in a
 * row of links here — which is why the layout no longer forks at `lg`, and why the wordmark
 * can hold the centre column on a phone and a desktop alike.
 */
export function Header({
  announcementActive = false,
  heroOverlay = false,
}: {
  announcementActive?: boolean;
  /** The homepage has hero media to sit over. Passed down because the header cannot see it. */
  heroOverlay?: boolean;
}) {
  const ta = useTranslations("actions");
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { count, setOpen } = useCart();
  const { open } = useNavUI();

  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    let last: boolean | null = null;
    const read = () => {
      raf = 0;
      const y = window.scrollY;
      // The announcement slide is a CSS custom property, not React state. It used to be an
      // inline `top` written on EVERY scroll event, which re-rendered a fixed layer on every
      // frame of a scroll — the worst possible combination on a phone.
      // .site-header--bar in globals.css turns --sy into max(0, BAR_H - scrollY).
      if (announcementActive) headerRef.current?.style.setProperty("--sy", String(Math.min(y, BAR_H)));
      const next = y > 40;
      if (next !== last) {
        last = next;
        setScrolled(next);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [announcementActive]);

  // Transparent only where there is genuinely something dark underneath: the homepage, scrolled
  // to the top, with hero media actually configured. Without that last term a removed video would
  // leave a white wordmark on a white band.
  const light = isHome && heroOverlay && !scrolled;

  // `-m-2 p-2` is a hit area, not spacing: it grows each control from the 24px glyph to a
  // 40px target without moving anything, because the negative margin gives back exactly what
  // the padding takes. The row's own gap-4 still reads as 16px of air between the marks.
  //
  // Full strength rather than the old opacity-80 wash: a permanently-faded icon is the one
  // thing a header cannot afford over a bright video frame. Hover now fades DOWN, which reads
  // as a press and costs the resting state nothing.
  const iconBtn =
    "focus-ring -m-2 p-2 transition-opacity duration-300 hover:opacity-60";

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "site-header fixed inset-x-0 z-40 transition-colors duration-300",
          announcementActive && "site-header--bar",
          light
            ? // Fully transparent over the RAW footage: the scrim that used to back this bar was
              // removed from components/home/Hero.tsx so the video keeps its own colours. Over a
              // bright frame the drop-shadow below is what carries legibility — the fix belongs
              // on this element, never as a wash back over the hero.
              //
              // Still no backdrop-filter: it would make the GPU re-blur the whole bar for every
              // decoded frame, which is what made the video stutter.
              "bg-transparent text-white"
            : "border-b border-line bg-paper text-ink",
        )}
      >
        <div
          className={cn(
            "mx-auto grid h-[60px] max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:h-[72px] md:px-8",
            // Icon/wordmark legibility over an arbitrary video frame, without a blur. drop-shadow
            // is the only one of the three options that works here: lucide icons are SVG strokes,
            // which text-shadow does not touch, and per-icon translucent pills would put grey
            // lozenges across a fashion hero.
            light && "drop-shadow-[0_1px_2px_rgb(0_0_0/0.55)]",
          )}
        >
          {/* start: the two controls that open something */}
          <div className="flex items-center gap-4 justify-self-start md:gap-5">
            <button className={iconBtn} onClick={() => open("menu")} aria-label={ta("menu")}>
              <Menu {...icon.nav} />
            </button>
            <button className={iconBtn} onClick={() => open("search")} aria-label={ta("search")}>
              <Search {...icon.nav} />
            </button>
          </div>

          {/* centre: the monogram, and nothing else. Square rather than the old wordmark's
              landscape slot — the FAVETAA lockup stacks the name UNDER the mark, which at a
              40px bar height would set the wordmark at ~8px. The name is carried by the footer
              lockup and the <title> instead, so the header shows the mark alone. */}
          <Link href="/" aria-label="FAVETAA — home" className="relative block h-9 w-9 shrink-0 md:h-11 md:w-11">
            <Logo light={light} />
          </Link>

          {/* end: language, then the controls that lead somewhere personal, plus the bag */}
          <div className="flex items-center gap-4 justify-self-end md:gap-5">
            {/* The language toggle leads this cluster rather than sitting among the icons,
                because it is a different KIND of control: the three marks beside it open
                something, this one reloads the whole document in another script. Putting it
                first, behind a hairline, is the fashion-house convention — and it means the
                bag stays at the outside edge where the thumb expects it. */}
            <LocaleSwitcher compact />
            <span
              aria-hidden
              className="hidden h-3.5 w-px bg-current opacity-25 sm:block"
            />
            <Link href="/wishlist" aria-label={ta("wishlist")} className={cn(iconBtn, "hidden sm:block")}>
              <Heart {...icon.nav} />
            </Link>
            <Link href="/account" aria-label={ta("account")} className={iconBtn}>
              <User {...icon.nav} />
            </Link>
            <button
              onClick={() => setOpen(true)}
              aria-label={count > 0 ? `${ta("cart")}, ${count}` : ta("cart")}
              className={iconBtn}
            >
              {/* The count anchors to the GLYPH, not to the button: the button now carries 8px
                  of hit-area padding, and hanging the badge off that box would float it out in
                  the gutter. Same wrapper the bottom bar uses. */}
              <span className="relative block">
                <ShoppingBag {...icon.nav} />
                {count > 0 && (
                  <span className="absolute -end-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-strong px-1 text-[10px] font-medium leading-none text-white">
                    {count}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Spacer so content clears the fixed header on non-home pages. Tracks the heights above;
          the announcement bar is still in normal flow here, so it is not part of this
          measurement. */}
      {!isHome && <div className="h-[60px] md:h-[72px]" />}
    </>
  );
}

/**
 * One asset for both states, still — but now for a better reason than the old pair being
 * byte-identical. The monogram's ALPHA is the line art: the loops are transparent and only the
 * strokes are opaque. So over the hero video `brightness-0 invert` flattens every opaque pixel
 * to pure white and the mark survives as clean white line work, while on paper the file's own
 * gold is what shows. A second white file would buy nothing and could drift.
 *
 * Gold is deliberately the ONE piece of colour on the page. globals.css states the UI has no
 * accent colour, and that still holds — this is the brand asset, not a token, and nothing else
 * reaches for it.
 *
 * `priority` is deprecated in Next 16 in favour of `preload`, and the docs recommend
 * loading="eager" over either for an above-the-fold image
 * (next/dist/docs/.../components/image.md, "preload" / "priority").
 */
function Logo({ light }: { light: boolean }) {
  return (
    <Image
      src="/assets/brand/logo-mark.png"
      alt=""
      fill
      loading="eager"
      sizes="44px"
      className={cn(
        "object-contain object-center transition-[filter] duration-300 motion-reduce:transition-none",
        light ? "brightness-0 invert" : "brightness-100 invert-0",
      )}
    />
  );
}
