import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

const CouponInput = z.object({
  code: z.string().trim().min(1, "Code is required"),
  type: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
  value: z.coerce.number().int().min(0),
  min_spend: z.coerce.number().int().min(0).default(0),
  expires_at: z.string().nullish(),
  usage_limit: z.coerce.number().int().positive().nullish(),
  active: z.boolean().default(true),
});

export async function GET() {
  const bad = await requirePermission("coupons:read");
  if (bad) return bad;
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const bad = await requirePermission("coupons:write");
  if (bad) return bad;
  const parsed = CouponInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const b = parsed.data;
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: b.code.toUpperCase(),
      type: b.type,
      value: b.value,
      min_spend: b.min_spend,
      expires_at: b.expires_at || null,
      usage_limit: b.usage_limit ?? null,
      active: b.active,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
