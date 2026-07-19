import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const maxDuration = 120;

const BUCKET = "media";
const MAX = 200 * 1024 * 1024; // 200MB (Supabase local storage may cap lower — use a URL for big files)

export async function POST(req: NextRequest) {
  const bad = await requirePermission("content:write");
  if (bad) return bad;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX) {
    return NextResponse.json({ error: "File too large — host it and paste the URL instead" }, { status: 400 });
  }

  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  // Homepage gallery reuses this endpoint for images — keep them in their own folder.
  const isImage = (file.type || "").startsWith("image/");
  const ext = (file.name.split(".").pop() || (isImage ? "jpg" : "mp4")).toLowerCase();
  const path = `${isImage ? "images" : "videos"}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || (isImage ? "image/jpeg" : "video/mp4"),
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
