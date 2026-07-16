import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "product-images";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bad = await requirePermission("products:write");
  if (bad) return bad;
  const { id } = await params;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?t=${Date.now()}`;

  const { data: imgs } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", id)
    .order("position", { ascending: false })
    .limit(1);
  const pos = ((imgs?.[0]?.position as number) ?? -1) + 1;

  const { data: row } = await supabase
    .from("product_images")
    .insert({ product_id: id, url, position: pos })
    .select("id, url, position")
    .single();
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bad = await requirePermission("products:write");
  if (bad) return bad;
  const { id } = await params;
  const { imageId } = await req.json();
  // Remove the Storage object too, not just the DB row (avoids orphaned files).
  const { data: img } = await supabase
    .from("product_images")
    .select("url")
    .eq("id", imageId)
    .eq("product_id", id)
    .maybeSingle();
  const path = img?.url ? img.url.split("?")[0].split(`/${BUCKET}/`)[1] : null;
  if (path) {
    try {
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      /* ignore storage cleanup errors */
    }
  }
  await supabase.from("product_images").delete().eq("id", imageId).eq("product_id", id);
  return NextResponse.json({ ok: true });
}

// Reorder images / set the cover. Body: { coverId } (move to position 0) or { order: string[] }.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bad = await requirePermission("products:write");
  if (bad) return bad;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: imgs } = await supabase
    .from("product_images")
    .select("id,position")
    .eq("product_id", id)
    .order("position", { ascending: true });
  let order = (imgs ?? []).map((i) => i.id as string);

  if (typeof body.coverId === "string" && order.includes(body.coverId)) {
    order = [body.coverId, ...order.filter((x) => x !== body.coverId)];
  } else if (Array.isArray(body.order)) {
    const known = new Set(order);
    order = (body.order as string[]).filter((x) => known.has(x));
  } else {
    return NextResponse.json({ error: "coverId or order required" }, { status: 400 });
  }

  await Promise.all(
    order.map((imgId, pos) =>
      supabase.from("product_images").update({ position: pos }).eq("id", imgId).eq("product_id", id),
    ),
  );
  return NextResponse.json({ ok: true });
}
