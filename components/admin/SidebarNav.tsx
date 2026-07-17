"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, FolderTree, Users, CreditCard,
  TicketPercent, BarChart3, Megaphone, ShieldCheck, ScrollText, Home,
  FileText, Palette, Phone, Settings, Film, Ruler, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Access } from "@/lib/rbac/access";
import type { Permission } from "@/lib/rbac/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:read" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "products:read" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory:read" },
      { href: "/admin/collections", label: "Collections", icon: FolderTree, permission: "categories:read" },
      { href: "/admin/content/variant-options", label: "Sizes & Lengths", icon: Ruler, permission: "content:read" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, permission: "orders:read" },
      { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "orders:read" },
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers:read" },
      { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, permission: "coupons:read" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content/home", label: "Home", icon: Home, permission: "content:read" },
      { href: "/admin/content/about", label: "Our Story", icon: FileText, permission: "content:read" },
      { href: "/admin/content/materials-colors", label: "Materials", icon: Palette, permission: "content:read" },
      { href: "/admin/content/contact", label: "Contact", icon: Phone, permission: "content:read" },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "content:write" },
      { href: "/admin/media", label: "Videos", icon: Film, permission: "content:write" },
      { href: "/admin/content/site-settings", label: "Site Settings", icon: Settings, permission: "content:read" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings/users", label: "Staff & Roles", icon: ShieldCheck, permission: "users:read" },
      { href: "/admin/audit", label: "Activity Log", icon: ScrollText, permission: "audit:read" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
    ],
  },
];

export function labelForPath(pathname: string): string {
  let best: { href: string; label: string } | null = null;
  for (const g of navGroups) {
    for (const it of g.items) {
      const match = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
      if (match && (!best || it.href.length > best.href.length)) best = it;
    }
  }
  return best?.label ?? "Admin";
}

export function SidebarNav({ access, onNavigate }: { access: Access; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => can(access, it.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <Link href="/admin" onClick={onNavigate} className="block border-b border-edge px-5 py-5">
        <div className="text-sm uppercase tracking-[0.24em] text-foreground">ALESSIA ABAYA</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-accent">Control Center</div>
      </Link>
      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-5 pb-2 text-[10px] uppercase tracking-[0.18em] text-faint">{group.label}</p>
            {group.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 border-s-2 px-5 py-2.5 text-[13px] transition-colors",
                  isActive(it.href)
                    ? "border-accent bg-elevated text-foreground"
                    : "border-transparent text-secondary hover:bg-elevated hover:text-foreground",
                )}
              >
                <it.icon size={16} strokeWidth={1.6} />
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
