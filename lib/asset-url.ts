/**
 * Product imagery and video live in Supabase Storage, not in the repo. Seed data and
 * content defaults keep using the historical "/assets/<dir>/<file>" paths as stable,
 * project-agnostic keys; this maps one onto its public Storage URL.
 *
 * Site chrome (brand, icon, payment, fonts, home) is still served from public/ and
 * passes through untouched.
 */
const BUCKET_FOR: Record<string, string> = {
  files: "product-images",
  video: "media",
};

/** "/assets/files/x.jpg" -> "<supabase>/storage/v1/object/public/product-images/files/x.jpg" */
export function assetUrl(p: string): string {
  const m = /^\/assets\/([^/]+)\/(.+)$/.exec(p);
  if (!m) return p;
  const bucket = BUCKET_FOR[m[1]];
  if (!bucket) return p;

  // Server-side only by construction: the sole importers are lib/content.ts (server-only) and
  // scripts/seed-supabase.ts, and the seed bakes absolute URLs into the DB, so nothing rebuilds
  // them at render time. SUPABASE_URL therefore always resolves, and it names the project being
  // written to — so seeding cloud from a shell (see DEPLOY.md) can't bake .env's localhost in.
  const base = process.env.SUPABASE_URL;
  if (!base) return p;

  // Today's filenames are all URL-safe, so this is a no-op — but a scraped name with a
  // space would otherwise produce a broken URL rather than an obvious error.
  const key = `${m[1]}/${m[2]}`.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${key}`;
}

/** Storage bucket + object key for a local-style asset path, or null if it stays in public/. */
export function assetKey(p: string): { bucket: string; key: string } | null {
  const m = /^\/assets\/([^/]+)\/(.+)$/.exec(p);
  if (!m) return null;
  const bucket = BUCKET_FOR[m[1]];
  return bucket ? { bucket, key: `${m[1]}/${m[2]}` } : null;
}
