"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n-navigation";
import type { NavItem } from "@/lib/data/navigation";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

/** How long the pointer may be off the menu before a hover-opened panel closes. */
const HOVER_GRACE_MS = 150;

/**
 * The header's "Collections" dropdown — the desktop face of the category list the drawer and
 * the bottom bar's sheet also show.
 *
 * A disclosure (button + aria-expanded), not an ARIA menu: its contents are ordinary links, and
 * role="menu" would take Tab away from them and demand arrow-key roving for no gain.
 *
 * Opens on hover for a mouse, on click for everything else. A click on a hover-opened panel pins
 * it instead of closing it — the reflex after a hover-open is to click the label, and closing the
 * panel under the pointer would read as a glitch. Escape, a click outside, or tabbing past the
 * last link closes it.
 *
 * The wrapper fills the header row's height, so `top-full` drops the panel from the header's
 * bottom edge; painted over the header's own hairline, it reads as the bar opening downwards.
 */
export function CollectionsMenu({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    pinned.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full items-center"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(hoverTimer.current);
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || pinned.current) return;
        hoverTimer.current = window.setTimeout(() => setOpen(false), HOVER_GRACE_MS);
      }}
      // Only when focus LANDS somewhere outside — Tab past the last link. A null relatedTarget
      // is a click on something unfocusable (or, in Safari, on one of these links, which it
      // never focuses), and closing then would hide the link between mousedown and click.
      // Genuine outside clicks are the pointerdown listener's job.
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !rootRef.current?.contains(next)) close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open && !pinned.current) {
            pinned.current = true;
            return;
          }
          if (open) close();
          else {
            pinned.current = true;
            setOpen(true);
          }
        }}
        className="nav-underline focus-ring flex items-center gap-1.5 py-1 font-button text-[12px] font-medium uppercase leading-none tracking-[0.16em]"
      >
        {label}
        <ChevronDown
          {...icon.micro}
          aria-hidden
          className={cn(
            "transition-transform duration-300 ease-lux motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Mounted while closed so the fade has something to run on; `invisible` is what takes the
          links out of the tab order and the accessibility tree in that state. -start-5 with px-5
          on the rows lines the category names up under the trigger's first letter. */}
      <div
        id={panelId}
        className={cn(
          "absolute -start-5 top-full min-w-60 border border-t-0 border-line bg-paper py-3 transition-[opacity,translate,visibility] duration-300 ease-lux motion-reduce:transition-none",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <ul>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className="focus-ring block px-5 py-2.5 text-[15px] text-ink transition-colors hover:text-strong aria-[current=page]:text-strong"
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
