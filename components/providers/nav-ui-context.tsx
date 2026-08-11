"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { NavItem } from "@/lib/data/navigation";

// Loaded on first open rather than mounted closed into every page, so their code —
// and, for the search drawer, the search action and price formatter it pulls in —
// stays out of the initial bundle.
const MobileMenu = dynamic(() =>
  import("@/components/layout/MobileMenu").then((m) => m.MobileMenu),
);
const SearchDrawer = dynamic(() =>
  import("@/components/layout/SearchDrawer").then((m) => m.SearchDrawer),
);
const CategoriesSheet = dynamic(() =>
  import("@/components/layout/CategoriesSheet").then((m) => m.CategoriesSheet),
);

type Panel = "menu" | "search" | "categories";

type NavUI = {
  navItems: NavItem[];
  open: (panel: Panel) => void;
  close: () => void;
  isOpen: (panel: Panel) => boolean;
};

const Ctx = createContext<NavUI | null>(null);

export function useNavUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNavUI must be used inside <NavUIProvider>");
  return ctx;
}

/**
 * Owns the three nav overlays and who is showing.
 *
 * The header and the bottom bar are separate fixed elements at opposite edges of the
 * screen, and both open the same panels. Holding the state here rather than in either
 * one means there is a single mounted instance of each drawer — two copies would let a
 * panel be open and closed at the same time depending on which control you used.
 *
 * One `active` panel rather than three booleans, so opening search from the bottom bar
 * while the menu is showing cannot leave both stacked on top of each other.
 *
 * Each panel is mounted on FIRST open and then stays mounted, so closing still has an
 * element to animate. The latch is set inside the handler rather than during render: a
 * render-phase write is unsafe under concurrent rendering, because a render React throws
 * away would still have flipped it.
 */
export function NavUIProvider({
  navItems,
  children,
}: {
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<Panel | null>(null);
  const [mounted, setMounted] = useState<Record<Panel, boolean>>({
    menu: false,
    search: false,
    categories: false,
  });

  const open = useCallback((panel: Panel) => {
    setMounted((m) => (m[panel] ? m : { ...m, [panel]: true }));
    setActive(panel);
  }, []);
  const close = useCallback(() => setActive(null), []);
  const isOpen = useCallback((panel: Panel) => active === panel, [active]);

  const value = useMemo(
    () => ({ navItems, open, close, isOpen }),
    [navItems, open, close, isOpen],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted.menu && (
        <MobileMenu open={active === "menu"} onClose={close} navItems={navItems} />
      )}
      {mounted.search && <SearchDrawer open={active === "search"} onClose={close} />}
      {mounted.categories && (
        <CategoriesSheet open={active === "categories"} onClose={close} navItems={navItems} />
      )}
    </Ctx.Provider>
  );
}
