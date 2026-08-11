import { CreditCard, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requirePageAccess } from "@/lib/admin-guard";
import { PageHeader, Panel, StatCard, StatusPill, Money, EmptyState } from "@/components/admin/ui";

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
  order: { number: number; email: string } | { number: number; email: string }[] | null;
};

const SETTLED = ["paid", "captured", "succeeded"];
const OPEN = ["new", "pending", "processing"];
const FAILED = ["failed", "cancelled", "declined"];

export default async function PaymentsPage() {
  await requirePageAccess("orders:read");
  const { data } = await supabase
    .from("payments")
    .select("id, amount, currency, provider, status, transaction_id, created_at, order:orders(number, email)")
    .order("created_at", { ascending: false })
    .limit(300);

  const payments = (data ?? []) as PaymentRow[];
  const settled = payments.filter((p) => SETTLED.includes(p.status.toLowerCase()));
  const captured = settled.reduce((s, p) => s + (p.amount ?? 0), 0);
  const pending = payments.filter((p) => OPEN.includes(p.status.toLowerCase())).length;
  const failed = payments.filter((p) => FAILED.includes(p.status.toLowerCase())).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Gateway transactions across all orders" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Captured" value={<Money cents={captured} />} icon={<CreditCard size={15} />} />
        <StatCard label="Settled" value={settled.length} icon={<CheckCircle2 size={15} />} />
        <StatCard label="Pending" value={pending} icon={<Clock size={15} />} />
        <StatCard label="Failed" value={failed} icon={<XCircle size={15} />} />
      </div>

      <Panel>
        <div className="border-b border-edge px-4 py-3">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-faint">Transactions ({payments.length})</h2>
        </div>
        {payments.length === 0 ? (
          <EmptyState title="No payments yet" description="Gateway transactions will appear here once orders are paid." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-4 py-3 text-start">Order</th>
                  <th className="px-3 py-3 text-start">Customer</th>
                  <th className="px-3 py-3 text-start">Provider</th>
                  <th className="px-3 py-3 text-start">Reference</th>
                  <th className="px-3 py-3 text-end">Amount</th>
                  <th className="px-3 py-3 text-start">Status</th>
                  <th className="px-3 py-3 text-start">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const order = Array.isArray(p.order) ? p.order[0] : p.order;
                  return (
                    <tr key={p.id} className="border-b border-edge/60 text-foreground">
                      <td className="px-4 py-2.5 font-medium">{order ? `#${order.number}` : "—"}</td>
                      <td className="px-3 py-2.5 text-secondary">{order?.email ?? "—"}</td>
                      <td className="px-3 py-2.5 capitalize">{p.provider}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-secondary">{p.transaction_id ?? "—"}</td>
                      <td className="px-3 py-2.5 text-end"><Money cents={p.amount} /></td>
                      <td className="px-3 py-2.5"><StatusPill status={p.status} /></td>
                      <td className="px-3 py-2.5 text-faint">{new Date(p.created_at).toLocaleDateString("en-US")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
