"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  level: string;
  read_at: string | null;
  created_at: string;
};

const DOT: Record<string, string> = {
  info: "bg-info", success: "bg-positive", warning: "bg-warn", error: "bg-danger",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/notifications");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      try {
        await fetch("/api/admin/notifications", { method: "PATCH", body: JSON.stringify({}) });
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative flex h-8 w-8 items-center justify-center text-secondary hover:text-foreground" aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 border border-edge bg-surface shadow-2xl">
          <div className="border-b border-edge px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-faint">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-faint">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className="flex gap-2.5 border-b border-edge/60 px-3 py-2.5 hover:bg-elevated">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT[n.level] ?? "bg-faint")} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-[11px] text-secondary">{n.body}</p>}
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>{inner}</Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
