import "server-only";
import { supabase } from "@/lib/supabase";
import { variantLabel } from "@/lib/variant-options";

const PAID = ["PAID", "FULFILLED"];

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

  const [ordersRes, itemsRes, lowRes, custCount, newCustCount, prodCount, lowCount] = await Promise.all([
    supabase.from("orders").select("status,total,created_at"),
    supabase.from("order_items").select("title,price,quantity,orders!inner(status)").in("orders.status", PAID),
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

  const orders = (ordersRes.data ?? []) as { status: string; total: number; created_at: string }[];
  const paid = orders.filter((o) => PAID.includes(o.status));
  const revenue = paid.reduce((s, o) => s + (o.total ?? 0), 0);

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  for (const o of paid) {
    const e = byDay.get(o.created_at.slice(0, 10));
    if (e) { e.revenue += o.total ?? 0; e.orders += 1; }
  }
  const revenueByDay = [...byDay.entries()].map(([day, v]) => ({ day: day.slice(5), revenue: v.revenue, orders: v.orders }));

  const statusMap = new Map<string, number>();
  for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  const ordersByStatus = [...statusMap.entries()].map(([name, value]) => ({ name, value }));

  const items = (itemsRes.data ?? []) as { title: string; price: number; quantity: number }[];
  const bs = new Map<string, { units: number; revenue: number }>();
  for (const it of items) {
    const e = bs.get(it.title) ?? { units: 0, revenue: 0 };
    e.units += it.quantity;
    e.revenue += it.price * it.quantity;
    bs.set(it.title, e);
  }
  const bestSellers = [...bs.entries()]
    .map(([title, v]) => ({ title, units: v.units, revenue: v.revenue }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  const lowRows = (lowRes.data ?? []) as unknown as {
    stock: number; color: string; size: string;
    products: { title: string } | { title: string }[] | null;
  }[];
  const lowStock = lowRows.map((v) => {
    const p = Array.isArray(v.products) ? v.products[0] : v.products;
    return { title: p?.title ?? "", variant: variantLabel({ color: v.color, size: v.size }), stock: v.stock };
  });

  const paidOrders = paid.length;
  return {
    revenue, paidOrders, totalOrders: orders.length, aov: paidOrders ? Math.round(revenue / paidOrders) : 0,
    customers: custCount.count ?? 0, newCustomers: newCustCount.count ?? 0, products: prodCount.count ?? 0,
    lowStockCount: lowCount.count ?? 0, revenueByDay, ordersByStatus, bestSellers, lowStock,
  };
}
