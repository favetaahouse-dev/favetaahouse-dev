import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CONTENT, SECTIONS, type Section } from "@/lib/content-schema";

export const runtime = "nodejs";

/** Content docs are JSON maps of scalar values or nested arrays/objects (repeaters). */
const ContentBody = z.record(z.string(), z.unknown());

function isSection(s: string): s is Section {
  return (SECTIONS as readonly string[]).includes(s);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const bad = await requirePermission("content:read");
  if (bad) return bad;
  const { section } = await params;
  if (!isSection(section)) return NextResponse.json({ error: "unknown" }, { status: 404 });
  const { data } = await supabase.from("content").select("data").eq("key", section).maybeSingle();
  return NextResponse.json({ ...DEFAULT_CONTENT[section], ...((data?.data as object) ?? {}) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const bad = await requirePermission("content:write");
  if (bad) return bad;
  const { section } = await params;
  if (!isSection(section)) return NextResponse.json({ error: "unknown" }, { status: 404 });
  const parsed = ContentBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid content payload" }, { status: 400 });
  await supabase.from("content").upsert({ key: section, data: parsed.data as never }, { onConflict: "key" });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
