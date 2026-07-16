import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";
import type { Permission } from "@/lib/rbac/permissions";

export const runtime = "nodejs";

/**
 * Each export is gated on the permission for the data it dumps — `requireAdmin()`
 * only proved "is staff", so any role could pull the full customer PII CSV.
 */
const ENTITY_PERMISSION: Record<string, Permission> = {
  orders: "orders:read",
  products: "products:read",
  customers: "customers:read",
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const perm = ENTITY_PERMISSION[entity];
  if (!perm) return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  const bad = await requirePermission(perm);
  if (bad) return bad;

  let rows: Record<string, unknown>[] = [];
  if (entity === "orders") {
    const { data } = await supabase
      .from("orders")
      .select("number,email,status,currency,subtotal,discount,total,coupon_code,tracking_number,created_at")
      .order("created_at", { ascending: false });
    rows = (data ?? []).map((o) => ({
      ...o,
      subtotal: ((o.subtotal as number) / 100).toFixed(2),
      discount: ((o.discount as number) / 100).toFixed(2),
      total: ((o.total as number) / 100).toFixed(2),
    }));
  } else if (entity === "products") {
    const { data } = await supabase
      .from("products")
      .select("handle,title,category,price_min,price_max,on_sale,featured")
      .order("title");
    rows = (data ?? []).map((p) => ({
      ...p,
      price_min: ((p.price_min as number) / 100).toFixed(2),
      price_max: ((p.price_max as number) / 100).toFixed(2),
    }));
  } else if (entity === "customers") {
    const { data } = await supabase.from("users").select("email,name,role,created_at").eq("role", "CUSTOMER");
    rows = data ?? [];
  } else {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${entity}.csv"`,
    },
  });
}
