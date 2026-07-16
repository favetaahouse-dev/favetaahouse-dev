import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";

export default async function AdminCustomers() {
  const [{ data: users }, { data: orders }] = await Promise.all([
    supabase.from("users").select("id, email, name, created_at").eq("role", "CUSTOMER").order("created_at", { ascending: false }),
    supabase.from("orders").select("user_id, email, total, status"),
  ]);

  const stats = new Map<string, { count: number; spend: number }>();
  for (const o of orders ?? []) {
    const key = (o.user_id as string) ?? (o.email as string);
    const s = stats.get(key) ?? { count: 0, spend: 0 };
    s.count += 1;
    if (["PAID", "FULFILLED"].includes(o.status as string)) s.spend += o.total as number;
    stats.set(key, s);
  }

  return (
    <div className="border border-white/10 bg-[#222320]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <h2 className="font-button text-xs uppercase tracking-[0.16em]">Customers ({(users ?? []).length})</h2>
        <a href="/api/admin/export/customers" className="text-xs text-gold hover:underline">
          Export CSV
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
              <th className="px-5 py-3 text-start">Name</th>
              <th className="px-3 py-3 text-start">Email</th>
              <th className="px-3 py-3 text-start">Orders</th>
              <th className="px-3 py-3 text-start">Spend</th>
              <th className="px-3 py-3 text-start">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const s = stats.get(u.id as string) ?? stats.get(u.email as string) ?? { count: 0, spend: 0 };
              return (
                <tr key={u.id as string} className="border-b border-white/5">
                  <td className="px-5 py-3">{(u.name as string) ?? "—"}</td>
                  <td className="px-3 py-3 text-white/60">{u.email as string}</td>
                  <td className="px-3 py-3">{s.count}</td>
                  <td className="px-3 py-3">{formatMoney(s.spend, "QAR")}</td>
                  <td className="px-3 py-3 text-white/40">{new Date(u.created_at as string).toLocaleDateString("en-US")}</td>
                </tr>
              );
            })}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-white/40">No customers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
