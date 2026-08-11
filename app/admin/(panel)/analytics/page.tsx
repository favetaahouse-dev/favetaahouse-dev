import { DollarSign, ShoppingCart, Users, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { getAnalytics } from "@/lib/data/admin-analytics";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatCard, AreaTrend, Donut, Panel, SectionLabel, Money } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function AnalyticsPage() {
  await requirePageAccess("analytics:read");
  const a = await getAnalytics(30);
  const money = (c: number) => formatMoney(c, "QAR");

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Last 30 days · sales, orders, customers and stock" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={money(a.revenue)} icon={<DollarSign size={15} />} spark={a.revenueByDay.map((d) => d.revenue)} />
        <StatCard label="Paid orders" value={a.paidOrders} icon={<ShoppingCart size={15} />} />
        <StatCard label="Avg order" value={money(a.aov)} icon={<TrendingUp size={15} />} />
        <StatCard label="Customers" value={a.customers} hint={`+${a.newCustomers} new`} icon={<Users size={15} />} />
        <StatCard label="Products" value={a.products} icon={<Package size={15} />} />
        <StatCard label="Low stock" value={a.lowStockCount} icon={<AlertTriangle size={15} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <SectionLabel className="mb-3">Revenue · last 30 days</SectionLabel>
          <AreaTrend data={a.revenueByDay} xKey="day" yKey="revenue" format="money" currency="QAR" />
        </Panel>
        <Panel className="p-5">
          <SectionLabel className="mb-3">Orders by status</SectionLabel>
          {a.ordersByStatus.length ? (
            <Donut data={a.ordersByStatus} />
          ) : (
            <p className="py-10 text-center text-xs text-faint">No orders yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="border-b border-edge px-4 py-3"><SectionLabel>Best sellers</SectionLabel></div>
          {a.bestSellers.length ? (
            <table className="w-full text-[13px]">
              <tbody>
                {a.bestSellers.map((b) => (
                  <tr key={b.title} className="border-b border-edge/60">
                    <td className="px-4 py-2.5 text-foreground">{b.title}</td>
                    <td className="px-4 py-2.5 text-end text-secondary">{b.units} sold</td>
                    <td className="px-4 py-2.5 text-end"><Money cents={b.revenue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-10 text-center text-xs text-faint">No sales yet.</p>
          )}
        </Panel>
        <Panel>
          <div className="border-b border-edge px-4 py-3"><SectionLabel>Low / out of stock</SectionLabel></div>
          {a.lowStock.length ? (
            <table className="w-full text-[13px]">
              <tbody>
                {a.lowStock.map((l, i) => (
                  <tr key={i} className="border-b border-edge/60">
                    <td className="px-4 py-2.5 text-foreground">{l.title}</td>
                    <td className="px-4 py-2.5 text-secondary">{l.variant}</td>
                    <td className={`px-4 py-2.5 text-end ${l.stock <= 0 ? "text-danger" : "text-warn"}`}>{l.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-10 text-center text-xs text-faint">All stocked up.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
