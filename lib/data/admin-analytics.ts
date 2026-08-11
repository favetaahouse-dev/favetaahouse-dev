import "server-only";
import { supabase } from "@/lib/supabase";
import { variantLabel } from "@/lib/variant-options";

export type AnalyticsData = {
  revenue: number; // cents
  paidOrders: number;
  totalOrders: number;
  aov: number; // cents
  customers: number;
  newCustomers: number;
  products: number;
  lowStockCount: number;
  revenueByDay: { day: string; revenue: number; orders: number }[]; // revenue in cents
  ordersByStatus: { name: string; value: number }[];
  bestSellers: { title: string; units: number; revenue: number }[]; // revenue in cents
  lowStock: { title: string; variant: string; stock: number }[];
};

export async function getAnalytics(days = 30): Promise<AnalyticsData> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Order revenue/status/best-sellers are aggregated in the DB (admin_order_analytics RPC) so
  // they are NOT computed from a PostgREST-truncated 1000-row slice. Counts use head+count.
  const [aggRes, lowRes, custCount, newCustCount, prodCount, lowCount] = await Promise.all([
    supabase.rpc("admin_order_analytics", { p_days: days }),
    supabase
      .from("variants")
      .select("stock,color,size,products!inner(title,status)")
      .lte("stock", 2)
      .eq("products.status", "active")
      .order("stock", { ascending: true })
      .limit(20),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "CUSTOMER"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "CUSTOMER").gte("created_at", since),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("variants").select("*", { count: "exact", head: true }).lte("stock", 2),
  ]);

  // Surface an RPC failure instead of silently rendering all-zeros as if there were no sales.
  if (aggRes.error) console.error("[analytics] admin_order_analytics RPC failed", aggRes.error);

  const agg = (aggRes.data ?? {}) as {
    revenue?: number;
    paidOrders?: number;
    totalOrders?: number;
    revenueByDay?: { day: string; revenue: number; orders: number }[];
    ordersByStatus?: { name: string; value: number }[];
    bestSellers?: { title: string; units: number; revenue: number }[];
  };

  const revenue = agg.revenue ?? 0;
  const paidOrders = agg.paidOrders ?? 0;
  const totalOrders = agg.totalOrders ?? 0;

  // Fill the full day axis — the RPC only returns days that actually had paid orders.
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  for (const r of agg.revenueByDay ?? []) {
    const e = byDay.get(r.day);
    if (e) {
      e.revenue = r.revenue;
      e.orders = r.orders;
    }
  }
  const revenueByDay = [...byDay.entries()].map(([day, v]) => ({ day: day.slice(5), revenue: v.revenue, orders: v.orders }));

  const ordersByStatus = agg.ordersByStatus ?? [];
  const bestSellers = agg.bestSellers ?? [];

  const lowRows = (lowRes.data ?? []) as unknown as {
    stock: number;
    color: string;
    size: string;
    products: { title: string } | { title: string }[] | null;
  }[];
  const lowStock = lowRows.map((v) => {
    const p = Array.isArray(v.products) ? v.products[0] : v.products;
    return { title: p?.title ?? "", variant: variantLabel({ color: v.color, size: v.size }), stock: v.stock };
  });

  return {
    revenue,
    paidOrders,
    totalOrders,
    aov: paidOrders ? Math.round(revenue / paidOrders) : 0,
    customers: custCount.count ?? 0,
    newCustomers: newCustCount.count ?? 0,
    products: prodCount.count ?? 0,
    lowStockCount: lowCount.count ?? 0,
    revenueByDay,
    ordersByStatus,
    bestSellers,
    lowStock,
  };
}
