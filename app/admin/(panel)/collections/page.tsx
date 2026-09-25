import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { requirePageAccess } from "@/lib/admin-guard";
import { getNavCategories } from "@/lib/data/navigation";
import { DEFAULT_CATEGORIES, normalizeCategory } from "@/lib/categories";
import { Badge, PageHeader, Panel, PanelHeader } from "@/components/admin/ui";

/**
 * The storefront's categories, exactly as the site shows them: the Collections menu, the
 * homepage filter and the footer all read this same list (getNavCategories), so the table is
 * the site's list rather than a description of it.
 *
 * This page used to list the `collections` table — nineteen rows scraped from the previous
 * store's catalogue, most of which (Jalabiyas, Liberty, Ramadan…) the house does not sell and
 * no page links to. It shows what the owner actually manages now, and how to add to it.
 */
export default async function AdminCategories() {
  await requirePageAccess("categories:read");
  const [en, ar, { data: products }] = await Promise.all([
    getNavCategories("en"),
    getNavCategories("ar"),
    supabase.from("products").select("category").eq("status", "active"),
  ]);
  const arLabel = new Map(ar.map((c) => [c.key, c.label]));
  const live = new Map<string, number>();
  for (const p of products ?? []) {
    const c = normalizeCategory((p.category as string) ?? "");
    live.set(c, (live.get(c) ?? 0) + 1);
  }
  const liveTotal = (products ?? []).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="What the site's Collections menu and homepage filter show, in this order."
      />
      <Panel>
        <PanelHeader title={`Categories (${en.length})`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                <th className="px-5 py-3 text-start font-medium">Category</th>
                <th className="px-3 py-3 text-start font-medium">Arabic</th>
                <th className="px-3 py-3 text-start font-medium">Live products</th>
                <th className="px-3 py-3 text-start font-medium">On the site</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {en.map((c) => {
                // New In has no value: it is every category's newest pieces, so it counts them all.
                const count = c.value == null ? liveTotal : (live.get(c.value) ?? 0);
                const kind =
                  c.value == null ? "automatic" : DEFAULT_CATEGORIES.includes(c.value) ? "house" : "added";
                return (
                  <tr key={c.key} className="border-b border-edge last:border-0">
                    <td className="px-5 py-3 text-foreground">{c.label}</td>
                    <td className="px-3 py-3 text-secondary" dir="rtl">
                      {arLabel.get(c.key)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-secondary">{count}</td>
                    <td className="px-3 py-3">
                      {kind === "automatic" ? (
                        <Badge tone="info">Newest arrivals</Badge>
                      ) : kind === "house" ? (
                        <Badge tone="accent">Always shown</Badge>
                      ) : (
                        <Badge>While in use</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <Link href={c.href} target="_blank" className="text-xs text-accent hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-edge px-5 py-3 text-[12px] leading-relaxed text-secondary">
          New In fills itself with the newest arrivals. Abayas, Kaftans and Ready to Wear always
          show on the site, even while nothing is in them. To add a category, type a new name in a
          product&rsquo;s Category field: it appears here, in the menu and in the homepage filter
          as soon as that product is live.
        </p>
      </Panel>
    </div>
  );
}
