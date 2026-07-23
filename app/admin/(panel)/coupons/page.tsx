"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { usePermissions } from "@/lib/rbac/use-permissions";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  min_spend: number;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState({ code: "", type: "PERCENT", value: "", minSpend: "", expiresAt: "", usageLimit: "" });
  const [busy, setBusy] = useState(false);
  const canWrite = usePermissions().can("coupons:write");

  const load = () => fetch("/api/admin/coupons").then((r) => r.json()).then(setCoupons);
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      code: form.code,
      type: form.type,
      value: form.type === "FIXED" ? Math.round(Number(form.value) * 100) : Number(form.value),
      min_spend: form.minSpend ? Math.round(Number(form.minSpend) * 100) : 0,
      expires_at: form.expiresAt || null,
      usage_limit: form.usageLimit || null,
    };
    const res = await fetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { toast.error((await res.json()).error ?? "Failed"); return; }
    toast.success("Coupon created");
    setForm({ code: "", type: "PERCENT", value: "", minSpend: "", expiresAt: "", usageLimit: "" });
    load();
  }

  async function toggle(c: Coupon) {
    await fetch(`/api/admin/coupons/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) });
    load();
  }
  async function remove(id: string) {
    await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    toast.success("Deleted");
    load();
  }

  const inp = "border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-signal";

  return (
    <div className="space-y-6">
      {canWrite && (
      <form onSubmit={create} className="border border-white/10 bg-[#212121] p-5">
        <h2 className="mb-4 font-button text-xs uppercase tracking-[0.16em]">New coupon</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <input placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inp} required />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={`${inp} bg-[#212121]`}>
            <option value="PERCENT">Percent %</option>
            <option value="FIXED">Fixed QAR</option>
          </select>
          <input type="number" placeholder={form.type === "PERCENT" ? "Value %" : "Value QAR"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inp} required />
          <input type="number" placeholder="Min spend QAR" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })} className={inp} />
          <input type="date" placeholder="Expires" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inp} />
          <input type="number" placeholder="Usage limit" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className={inp} />
          <button type="submit" disabled={busy} className="bg-signal px-4 py-2 text-xs font-medium text-white hover:opacity-90">
            Create
          </button>
        </div>
      </form>
      )}

      <div className="border border-white/10 bg-[#212121]">
        <div className="border-b border-white/10 px-5 py-3">
          <h2 className="font-button text-xs uppercase tracking-[0.16em]">Coupons ({coupons.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
                <th className="px-5 py-3 text-start">Code</th>
                <th className="px-3 py-3 text-start">Discount</th>
                <th className="px-3 py-3 text-start">Min spend</th>
                <th className="px-3 py-3 text-start">Used</th>
                <th className="px-3 py-3 text-start">Expires</th>
                <th className="px-3 py-3 text-start">Active</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="px-5 py-3 font-medium">{c.code}</td>
                  <td className="px-3 py-3">{c.type === "PERCENT" ? `${c.value}%` : formatMoney(c.value, "QAR")}</td>
                  <td className="px-3 py-3">{c.min_spend ? formatMoney(c.min_spend, "QAR") : "—"}</td>
                  <td className="px-3 py-3">{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                  <td className="px-3 py-3 text-white/50">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-US") : "—"}</td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <button onClick={() => toggle(c)} className={c.active ? "text-emerald-400" : "text-white/40"}>
                        {c.active ? "Active" : "Inactive"}
                      </button>
                    ) : (
                      <span className={c.active ? "text-emerald-400" : "text-white/40"}>{c.active ? "Active" : "Inactive"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite && (
                      <button onClick={() => remove(c.id)} className="text-white/40 hover:text-red-400" aria-label="Delete">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-white/40">No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
