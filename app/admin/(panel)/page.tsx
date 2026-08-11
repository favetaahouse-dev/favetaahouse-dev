import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { skipcashEnabled, SKIPCASH_ENV } from "@/lib/skipcash";
import { getCommerceSettings } from "@/lib/content";
import { getAnalytics } from "@/lib/data/admin-analytics";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { ResetStatsButton } from "@/components/admin/ResetStatsButton";
import { requirePageAccess } from "@/lib/admin-guard";
import { hasPermission } from "@/lib/admin-auth";

export default async function AdminDashboard() {
  const actor = await requirePageAccess("dashboard:read");
  const canReset = hasPermission(actor, "backup:manage");

  // Revenue/AOV/best-sellers come from the DB aggregation RPC — NOT a PostgREST-truncated
  // 1000-row slice (which silently understated every figure here past 1000 orders).
  const analytics = await getAnalytics(14);
  const revenue = analytics.revenue;
  const aov = analytics.aov;
  // revenueByDay is in cents; this dashboard's chart expects whole-QAR values.
  const series = analytics.revenueByDay.map((d) => ({ day: d.day, revenue: Math.round(d.revenue / 100), orders: d.orders }));
  const topProducts = analytics.bestSellers.slice(0, 5).map((b) => [b.title, b.units] as [string, number]);

  const cards = [
    { label: "Revenue (paid)", value: formatMoney(revenue, "QAR") },
    { label: "Orders", value: String(analytics.totalOrders) },
    { label: "Avg order value", value: formatMoney(aov, "QAR") },
    { label: "Customers", value: String(analytics.customers) },
    { label: "Products", value: String(analytics.products) },
    { label: "Low stock", value: String(analytics.lowStockCount) },
  ];

  const commerce = await getCommerceSettings();
  const emailConfigured = !!process.env.RESEND_API_KEY;

  return (
    <div className="space-y-6">
      {canReset && (
        <div className="flex justify-end">
          <ResetStatsButton />
        </div>
      )}

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
