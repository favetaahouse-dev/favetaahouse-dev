import { supabase } from "@/lib/supabase";
import { OrderRow } from "@/components/admin/OrderRow";

export default async function AdminOrders() {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, email, total, status, tracking_number, created_at, items:order_items(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="border border-white/10 bg-[#222320]">
      <div className="border-b border-white/10 px-5 py-3">
        <h2 className="font-button text-xs uppercase tracking-[0.16em]">Orders ({(orders ?? []).length})</h2>
      </div>
      {(orders ?? []).length === 0 ? (
        <p className="py-16 text-center text-sm text-white/40">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                <th className="px-5 py-3 text-start">Order</th>
                <th className="px-3 py-3 text-start">Customer</th>
                <th className="px-3 py-3 text-start">Total</th>
                <th className="px-3 py-3 text-start">Status</th>
                <th className="px-3 py-3 text-start">Tracking</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => (
                <OrderRow
                  key={o.id as string}
                  order={{
                    id: o.id as string,
                    number: o.number as number,
                    email: o.email as string,
                    total: o.total as number,
                    status: o.status as string,
                    trackingNumber: (o.tracking_number as string) ?? "",
                    itemCount: ((o.items ?? []) as unknown[]).length,
                    date: new Date(o.created_at as string).toLocaleDateString("en-US"),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
