import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { OrderRow } from "@/components/admin/OrderRow";
import { requirePageAccess } from "@/lib/admin-guard";
import { cn } from "@/lib/utils";

/**
 * Every status is listed, PENDING included.
 *
 * A pending order is not noise — it is a customer who reached checkout and whose payment has
 * not confirmed yet, which is the single most useful thing an owner can look at. It becomes
 * PAID only when mark_order_paid runs from the SkipCash webhook, so anything sitting in PENDING
 * for long means the payment never came back.
 */
const STATUS_TABS = ["ALL", "PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"] as const;

type OrderItemRow = { id: string; fulfillment: string };

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePageAccess("orders:read");
  const { status } = await searchParams;
  const active = (STATUS_TABS as readonly string[]).includes(status ?? "") ? status! : "ALL";

  // No status filter in the query. The whole set is read once and filtered in memory so the
  // tab counts are real rather than "the count of whatever this tab happens to show".
  const { data } = await supabase
    .from("orders")
    // fulfillment on the embedded items, not an !inner filter: joining on order_items would
    // duplicate an order row once per matching item.
    .select("id, number, email, total, status, tracking_number, created_at, items:order_items(id, fulfillment)")
    .order("created_at", { ascending: false });

  const orders = data ?? [];
  const counts = orders.reduce<Record<string, number>>(
    (acc, o) => {
      const s = o.status as string;
      acc[s] = (acc[s] ?? 0) + 1;
      acc.ALL += 1;
      return acc;
    },
    { ALL: 0 },
  );
  const shown = active === "ALL" ? orders : orders.filter((o) => o.status === active);

  return (
    <div className="border border-white/10 bg-[#212121]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <h2 className="font-button text-xs uppercase tracking-[0.16em]">Orders ({counts.ALL})</h2>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((s) => {
            const n = counts[s] ?? 0;
            return (
              <Link
                key={s}
                href={s === "ALL" ? "/admin/orders" : `/admin/orders?status=${s}`}
                className={cn(
                  "border px-2.5 py-1 text-[11px] tracking-[0.08em] uppercase transition-colors",
                  active === s
                    ? "border-signal bg-signal/10 text-white"
                    : "border-white/15 text-white/50 hover:border-white/40 hover:text-white/80",
                )}
              >
                {s === "ALL" ? "All" : s.toLowerCase()}
                <span className="ms-1.5 text-white/40">{n}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/40">
          {counts.ALL === 0 ? "No orders yet." : `No ${active.toLowerCase()} orders.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                <th className="px-5 py-3 text-start">Order</th>
                <th className="px-3 py-3 text-start">Customer</th>
                <th className="px-3 py-3 text-start">Items</th>
                <th className="px-3 py-3 text-start">Total</th>
                <th className="px-3 py-3 text-start">Status</th>
                <th className="px-3 py-3 text-start">Tracking</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const items = (o.items ?? []) as OrderItemRow[];
                return (
                  <OrderRow
                    key={o.id as string}
                    order={{
                      id: o.id as string,
                      number: o.number as number,
                      email: o.email as string,
                      total: o.total as number,
                      status: o.status as string,
                      trackingNumber: (o.tracking_number as string) ?? "",
                      itemCount: items.length,
                      mtoCount: items.filter((i) => i.fulfillment === "MTO").length,
                      rtwCount: items.filter((i) => i.fulfillment !== "MTO").length,
                      date: new Date(o.created_at as string).toLocaleDateString("en-US"),
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
