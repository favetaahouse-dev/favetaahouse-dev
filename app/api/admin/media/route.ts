import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

/**
 * Hands the browser a URL it can upload one file to, straight to Supabase Storage — and takes
 * files back out again.
 *
 * On upload the file never passes through this function, and that is the entire point. Vercel
 * caps a function's REQUEST BODY at 4.5 MB and rejects anything larger at the edge, before any of
 * this code runs — measured against production: a 4.0 MB body reached the handler and got a 401
 * from requirePermission, while 4.4 MB came back `413 FUNCTION_PAYLOAD_TOO_LARGE`. An earlier
 * version read the whole upload with `req.formData()`, so a hero-sized video failed on a rule the
 * code could not see and reported an error it had not produced.
 *
 * So the only thing crossing Vercel is a few hundred bytes of JSON in each direction, and the
 * ceiling becomes Supabase's own project limit rather than 4.5 MB.
 *
 * Signed upload URLs are scoped to ONE object path and expire in two hours, so handing one to
 * the browser grants nothing beyond writing the file that was just authorised here.
 */

const BUCKET = "media";
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v"];

/** The public-URL shape Storage serves this bucket under; also what DELETE parses back. */
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

export async function POST(req: NextRequest) {
  const bad = await requirePermission("content:write");
  if (bad) return bad;

  const { name, type } = (await req.json().catch(() => ({}))) as {
    name?: string;
    type?: string;
  };
  if (!name) return NextResponse.json({ error: "No file name" }, { status: 400 });

  // Trust the browser's MIME only to pick a folder; fall back to the extension when it is blank,
  // which some Windows browsers do for a file dragged out of Explorer.
  const ext = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const isImage = (type || "").startsWith("image/") || IMAGE_EXTS.includes(ext);
  const isVideo = (type || "").startsWith("video/") || VIDEO_EXTS.includes(ext);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Only image and video files are allowed" }, { status: 400 });
  }

  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const path = `${isImage ? "images" : "videos"}/${Date.now()}.${ext || (isImage ? "jpg" : "mp4")}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    // Returned now rather than derived on the client, so the public URL is always built the same
    // way as everywhere else in the app.
    publicUrl: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    contentType: type || (isImage ? "image/jpeg" : "video/mp4"),
  });
}

/**
 * Delete one object from this bucket, given the public URL the CMS is holding.
 *
 * Without this, "remove" only ever meant "stop pointing at it": the row lost the URL and the file
 * stayed in Storage forever, billable and unreachable. The caller clears the CMS field FIRST and
 * calls this second — if this fails, the worst case is an orphan nobody can see, whereas the
 * other order would leave the storefront pointing at an object that no longer exists.
 *
 * Only this bucket's own public URLs are accepted. Anything else — another bucket, another host,
 * a path traversal, or one of the "/assets/..." defaults that live in the repo rather than in
 * Storage — is a no-op rather than an error, because the caller's job is done either way.
 */
export async function DELETE(req: NextRequest) {
  const bad = await requirePermission("content:write");
  if (bad) return bad;

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const key = objectKeyFor(url);
  if (!key) return NextResponse.json({ ok: true, deleted: false });

  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: true });
}

/** The object key inside BUCKET for one of our public URLs, or null if it is not one. */
function objectKeyFor(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    // The `?t=` cache-buster other upload paths append is a query string, so parsing drops it.
    parsed = new URL(url);
  } catch {
    return null;
  }
  const base = process.env.SUPABASE_URL;
  if (!base) return null;
  let expected: URL;
  try {
    expected = new URL(base);
  } catch {
    return null;
  }
  // Host check as well as path: a URL on someone else's domain can carry any path it likes.
  if (parsed.origin !== expected.origin) return null;
  if (!parsed.pathname.startsWith(PUBLIC_PREFIX)) return null;

  const key = decodeURIComponent(parsed.pathname.slice(PUBLIC_PREFIX.length));
  // Storage treats ".." as a literal segment rather than a traversal, but a key that escapes the
  // prefix it was matched against has no legitimate source, so refuse it outright.
  return key && !key.split("/").includes("..") ? key : null;
}
