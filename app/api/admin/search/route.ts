import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export type SearchGroup = { type: string; items: { label: string; sub?: string; href: string }[] };

export async function GET(req: Request) {
  const bad = await requireAdmin();
  if (bad) return bad;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ groups: [] });
  const like = `%${q}%`;
  const isNum = /^\d+$/.test(q);

  const [products, ordersByEmail, ordersByNumber, customers, coupons, collections] = await Promise.all([
    supabase.from("products").select("id, handle, title").ilike("title", like).limit(6),
    supabase.from("orders").select("id, number, email").ilike("email", like).limit(6),
    isNum
      ? supabase.from("orders").select("id, number, email").eq("number", Number(q)).limit(4)
      : Promise.resolve({ data: [] as { id: string; number: number; email: string }[] }),
    supabase.from("users").select("id, name, email").eq("role", "CUSTOMER").ilike("email", like).limit(6),
    supabase.from("coupons").select("id, code").ilike("code", like).limit(4),
    supabase.from("collections").select("id, handle, title").ilike("title", like).limit(4),
  ]);

  const orderMap = new Map<string, { id: string; number: number; email: string }>();
  for (const o of [...(ordersByNumber.data ?? []), ...(ordersByEmail.data ?? [])]) orderMap.set(o.id, o);

  const groups: SearchGroup[] = [
    {
      type: "Products",
      items: (products.data ?? []).map((p) => ({ label: p.title, sub: p.handle, href: `/admin/products/${p.id}` })),
    },
    {
      type: "Orders",
      items: [...orderMap.values()].map((o) => ({ label: `#${o.number}`, sub: o.email, href: `/admin/orders/${o.id}` })),
    },
    {
      type: "Customers",
      items: (customers.data ?? []).map((c) => ({ label: c.name ?? c.email, sub: c.email, href: `/admin/customers/${c.id}` })),
    },
    {
      type: "Coupons",
      items: (coupons.data ?? []).map((c) => ({ label: c.code, href: `/admin/coupons` })),
    },
    {
      type: "Collections",
      items: (collections.data ?? []).map((c) => ({ label: c.title, sub: c.handle, href: `/admin/collections` })),
    },
  ].filter((g) => g.items.length > 0);

  return NextResponse.json({ groups });
}
