"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Modal } from "./ui";
import type { SearchGroup } from "@/app/api/admin/search/route";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setGroups([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setGroups(d.groups ?? []);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const flat = groups.flatMap((g) => g.items);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-edge bg-canvas px-2.5 py-1.5 text-xs text-faint hover:border-accent/50"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-edge px-1 text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="lg">
        <div className="flex items-center gap-2 border-b border-edge pb-3">
          <Search size={16} className="text-faint" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && flat[0]) go(flat[0].href); }}
            placeholder="Search products, orders, customers…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
          />
        </div>
        <div className="mt-2 max-h-[50vh] overflow-y-auto">
          {loading && <p className="px-1 py-6 text-center text-xs text-faint">Searching…</p>}
          {!loading && q.trim().length >= 2 && flat.length === 0 && (
            <p className="px-1 py-6 text-center text-xs text-faint">No matches for “{q}”.</p>
          )}
          {groups.map((g) => (
            <div key={g.type} className="mb-3">
              <p className="px-1 py-1 text-[10px] uppercase tracking-[0.16em] text-faint">{g.type}</p>
              {g.items.map((it, i) => (
                <button
                  key={`${g.type}-${i}`}
                  onClick={() => go(it.href)}
                  className="flex w-full items-center justify-between gap-3 px-2 py-2 text-start text-[13px] text-foreground hover:bg-elevated"
                >
                  <span className="truncate">{it.label}</span>
                  {it.sub && <span className="truncate text-xs text-faint">{it.sub}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
