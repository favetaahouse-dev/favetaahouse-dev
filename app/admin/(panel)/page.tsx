import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";
import { skipcashEnabled, SKIPCASH_ENV } from "@/lib/skipcash";
import { getCommerceSettings } from "@/lib/content";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { requirePageAccess } from "@/lib/admin-guard";

function last14Days(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default async function AdminDashboard() {
  await requirePageAccess("dashboard:read");
  const [{ count: products }, { count: orders }, paidOrders, { count: lowStock }, { count: customers }, orderItems] =
    await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("total, status, created_at").in("status", ["PAID", "FULFILLED"]),
      supabase.from("variants").select("*", { count: "exact", head: true }).lte("stock", 2),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "CUSTOMER"),
      supabase.from("order_items").select("title, quantity, price"),
    ]);

  const paid = paidOrders.data ?? [];
  const revenue = paid.reduce((n, o) => n + (o.total as number), 0);
  const aov = paid.length ? Math.round(revenue / paid.length) : 0;

  // 14-day revenue timeseries
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const d of last14Days()) byDay.set(d, { revenue: 0, orders: 0 });
  for (const o of paid) {
    const day = String(o.created_at).slice(0, 10);
    const e = byDay.get(day);
    if (e) { e.revenue += (o.total as number) / 100; e.orders += 1; }
  }
  const series = [...byDay.entries()].map(([day, v]) => ({ day: day.slice(5), revenue: Math.round(v.revenue), orders: v.orders }));

  // top products by units sold
  const prodMap = new Map<string, number>();
  for (const it of orderItems.data ?? []) prodMap.set(it.title as string, (prodMap.get(it.title as string) ?? 0) + (it.quantity as number));
  const topProducts = [...prodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const cards = [
    { label: "Revenue (paid)", value: formatMoney(revenue, "QAR") },
    { label: "Orders", value: String(orders ?? 0) },
    { label: "Avg order value", value: formatMoney(aov, "QAR") },
    { label: "Customers", value: String(customers ?? 0) },
    { label: "Products", value: String(products ?? 0) },
    { label: "Low stock", value: String(lowStock ?? 0) },
  ];

  const commerce = await getCommerceSettings();
  const emailConfigured = !!process.env.RESEND_API_KEY;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="border border-white/10 bg-[#212121] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">{c.label}</p>
            <p className="mt-2 text-lg">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-white/10 bg-[#212121] p-5">
        <h2 className="mb-4 font-button text-xs uppercase tracking-[0.16em]">Payments &amp; Email</h2>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <StatusRow label="Payment provider" value={skipcashEnabled ? "SkipCash" : "Demo mode"} ok={skipcashEnabled} />
          <StatusRow
            label="SkipCash environment"
            value={skipcashEnabled ? SKIPCASH_ENV : "—"}
            ok={skipcashEnabled && SKIPCASH_ENV === "production"}
          />
          <StatusRow
            label="Order emails"
            value={commerce.emailEnabled ? (emailConfigured ? "On" : "On · no API key") : "Off"}
            ok={commerce.emailEnabled && emailConfigured}
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/30">
          Gateway &amp; email keys are set via environment variables (see <span className="text-signal">DEPLOY.md</span>).
          Shipping, tax and the email toggle are editable under{" "}
          <Link href="/admin/content/commerce" className="text-signal hover:underline">
            Commerce &amp; Payments
          </Link>
          .
        </p>
      </div>

      <div className="border border-white/10 bg-[#212121] p-5">
        <h2 className="mb-4 font-button text-xs uppercase tracking-[0.16em]">Revenue · last 14 days</h2>
        <RevenueChart data={series} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-white/10 bg-[#212121]">
          <div className="border-b border-white/10 px-5 py-3">
            <h2 className="font-button text-xs uppercase tracking-[0.16em]">Top products</h2>
          </div>
          <div className="divide-y divide-white/5">
            {topProducts.length === 0 && <p className="px-5 py-6 text-sm text-white/40">No sales yet.</p>}
            {topProducts.map(([title, units]) => (
              <div key={title} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{title}</span>
                <span className="text-white/50">{units} sold</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-[#212121]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="font-button text-xs uppercase tracking-[0.16em]">Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/5">
            {[
              { href: "/admin/orders", label: "Manage orders" },
              { href: "/admin/products", label: "Edit products" },
              { href: "/admin/coupons", label: "Create coupon" },
              { href: "/api/admin/export/orders", label: "Export orders CSV" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="bg-[#212121] px-5 py-6 text-sm hover:bg-white/5 hover:text-signal">
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border border-white/5 bg-black/10 px-3 py-2">
      <span className="text-white/50">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
        {value}
      </span>
    </div>
  );
}
