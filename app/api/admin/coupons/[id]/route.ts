import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bad = await requirePermission("coupons:write");
  if (bad) return bad;
  const { id } = await params;
  const b = await req.json();
  const patch: {
    active?: boolean;
    value?: number;
    min_spend?: number;
    type?: string;
    expires_at?: string | null;
    usage_limit?: number | null;
  } = {};
  if (b.active != null) patch.active = !!b.active;
  if (b.value != null) patch.value = Math.max(0, Math.floor(Number(b.value)));
  if (b.min_spend != null) patch.min_spend = Math.max(0, Math.floor(Number(b.min_spend)));
  if (b.type != null) patch.type = b.type === "FIXED" ? "FIXED" : "PERCENT";
  if ("expires_at" in b) patch.expires_at = b.expires_at || null;
  if ("usage_limit" in b) patch.usage_limit = b.usage_limit ? Math.floor(Number(b.usage_limit)) : null;
  const { data, error } = await supabase.from("coupons").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bad = await requirePermission("coupons:write");
  if (bad) return bad;
  const { id } = await params;
  await supabase.from("coupons").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
