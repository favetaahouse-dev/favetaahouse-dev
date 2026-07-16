import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

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
  const bad = await requireAdmin();
  if (bad) return bad;
  const { entity } = await params;

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
