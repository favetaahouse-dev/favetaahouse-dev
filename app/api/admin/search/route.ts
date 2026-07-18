import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, requireAdmin, sessionUser } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export type SearchGroup = { type: string; items: { label: string; sub?: string; href: string }[] };

const none = <T>() => Promise.resolve({ data: [] as T[] });

export async function GET(req: Request) {
  // Any staff may search; each source is then gated on its own permission, so a
  // read_only session can't surface customers or coupons through the search box.
  const bad = await requireAdmin();
  if (bad) return bad;
  const u = sessionUser(await auth());

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ groups: [] });
  const like = `%${q}%`;
  const isNum = /^\d+$/.test(q);

  // Gate at query construction, not on the results — a denied source must never hit the DB.
  const canProducts = hasPermission(u, "products:read");
  const canOrders = hasPermission(u, "orders:read");
  const canCustomers = hasPermission(u, "customers:read");
  const canCoupons = hasPermission(u, "coupons:read");
  const canCollections = hasPermission(u, "categories:read");

  const [products, ordersByEmail, ordersByNumber, customers, coupons, collections] = await Promise.all([
    canProducts
      ? supabase.from("products").select("id, handle, title").ilike("title", like).limit(6)
      : none<{ id: string; handle: string; title: string }>(),
    canOrders
      ? supabase.from("orders").select("id, number, email").ilike("email", like).limit(6)
      : none<{ id: string; number: number; email: string }>(),
    canOrders && isNum
      ? supabase.from("orders").select("id, number, email").eq("number", Number(q)).limit(4)
      : none<{ id: string; number: number; email: string }>(),
    canCustomers
      ? supabase.from("users").select("id, name, email").eq("role", "CUSTOMER").ilike("email", like).limit(6)
      : none<{ id: string; name: string | null; email: string }>(),
    canCoupons
      ? supabase.from("coupons").select("id, code").ilike("code", like).limit(4)
      : none<{ id: string; code: string }>(),
    canCollections
      ? supabase.from("collections").select("id, handle, title").ilike("title", like).limit(4)
      : none<{ id: string; handle: string; title: string }>(),
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
      // No /admin/customers/[id] route exists — link the list, not a 404.
      items: (customers.data ?? []).map((c) => ({ label: c.name ?? c.email, sub: c.email, href: `/admin/customers` })),
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
