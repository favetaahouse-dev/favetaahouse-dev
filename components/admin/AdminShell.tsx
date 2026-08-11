"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, ExternalLink, Sun, Moon } from "lucide-react";
import { signOut } from "next-auth/react";
import { SidebarNav, labelForPath } from "./SidebarNav";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";
import { can, type Access } from "@/lib/rbac/access";

export function AdminShell({
  userEmail,
  access,
  initialTheme,
  children,
}: {
  userEmail: string;
  access: Access;
  initialTheme: "dark" | "light";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.cookie = `admin-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="admin-theme flex min-h-screen bg-canvas text-foreground" data-theme={theme}>
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-56 border-e border-edge bg-surface md:block">
        <SidebarNav access={access} />
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-64 bg-surface transition-transform md:hidden",
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
        )}
      >
        <SidebarNav access={access} onNavigate={() => setOpen(false)} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ps-56">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-edge bg-canvas/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <Menu size={20} />
            </button>
            <span className="text-sm uppercase tracking-[0.16em]">{labelForPath(pathname)}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <GlobalSearch />
            {can(access, "notifications:read") && <NotificationBell />}
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center text-secondary hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <span className="hidden text-xs text-faint lg:inline">{userEmail}</span>
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 text-xs text-secondary hover:text-accent sm:flex">
              <ExternalLink size={14} /> <span className="hidden lg:inline">View site</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-accent"
              aria-label="Logout"
            >
              <LogOut size={14} /> <span className="hidden lg:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
