"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState, Spinner } from "./primitives";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchText?: (row: T) => string;
  selectable?: boolean;
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  pageSize?: number;
  toolbar?: ReactNode;
  rowHref?: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

const alignClass = { left: "text-start", right: "text-end", center: "text-center" };

export function DataTable<T>({
  columns, rows, getRowId, searchable, searchPlaceholder = "Search…", searchText,
  selectable, bulkActions, pageSize = 20, toolbar, rowHref, loading,
  emptyTitle = "Nothing here yet", emptyDescription,
}: DataTableProps<T>) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!q.trim() || !searchText) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => searchText(r).toLowerCase().includes(needle));
  }, [rows, q, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const val = col.sortValue;
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const allOnPageSelected = paged.length > 0 && paged.every((r) => selected.has(getRowId(r)));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach((r) => next.delete(getRowId(r)));
      else paged.forEach((r) => next.add(getRowId(r)));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="border border-edge bg-surface">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-edge p-3">
          {searchable && (
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(0); }}
                placeholder={searchPlaceholder}
                className="w-56 border border-edge bg-canvas py-1.5 ps-8 pe-3 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-accent/60"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {selectable && selected.size > 0 && bulkActions && (
        <div className="flex items-center gap-3 border-b border-edge bg-elevated px-3 py-2 text-xs">
          <span className="text-secondary">{selected.size} selected</span>
          <div className="flex items-center gap-2">{bulkActions([...selected], clearSelection)}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-edge">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-faint",
                    alignClass[c.align ?? "left"],
                    c.sortable && "cursor-pointer select-none",
                  )}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sort?.key === c.key && (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="py-16 text-center"><Spinner /></td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={colSpan}><EmptyState title={emptyTitle} description={emptyDescription} /></td></tr>
            ) : (
              paged.map((row) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    className={cn(
                      "border-b border-edge/60 text-[13px] text-foreground",
                      rowHref && "cursor-pointer hover:bg-elevated",
                    )}
                    onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                  >
                    {selectable && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(id)} onChange={() => toggleOne(id)} aria-label="Select row" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-3 py-2.5", alignClass[c.align ?? "left"], c.className)}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-edge px-3 py-2 text-xs text-secondary">
          <span>{sorted.length} results</span>
          <div className="flex items-center gap-2">
            <button className="p-1 disabled:opacity-40" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)} aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
            <span>{clampedPage + 1} / {pageCount}</span>
            <button className="p-1 disabled:opacity-40" disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
