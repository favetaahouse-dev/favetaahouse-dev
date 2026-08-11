/**
 * Upload product imagery from public/assets into Supabase Storage, so the repo carries
 * no product media. Idempotent (upserts), safe to re-run, and safe to point at a new
 * project — re-run it, then `npm run seed` to rewrite the URLs in the DB.
 *
 * Run: npm run upload-assets            (add --dry-run to list without uploading)
 */
import process from "node:process";
try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const DRY = process.argv.includes("--dry-run");
const PUB = path.join(process.cwd(), "public", "assets");
const CONCURRENCY = 8;

/** local dir under public/assets -> storage bucket. Mirrors BUCKET_FOR in lib/asset-url.ts. */
const TARGETS: { dir: string; bucket: string }[] = [
  { dir: "files", bucket: "product-images" },
];

/**
 * The scrape saved Shopify's WebP payloads under .jpg names, so the extension lies.
 * Storage serves whatever Content-Type we set here, so sniff the real one.
 */
function contentType(buf: Buffer, file: string): string {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (path.extname(file).toLowerCase() === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function walk(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r));
    else out.push(r);
  }
  return out;
}

/** Run `worker` over `items` with a fixed pool, so 500+ uploads don't open 500 sockets. */
async function pool<T>(items: T[], n: number, worker: (t: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) await worker(items[i], i);
    }),
  );
}

async function main() {
  console.log(`${DRY ? "[dry run] " : ""}Uploading assets to ${url}\n`);
  let totalFiles = 0;
  let totalBytes = 0;
  const failures: string[] = [];

  for (const { dir, bucket } of TARGETS) {
    const root = path.join(PUB, dir);
    if (!fs.existsSync(root)) {
      console.log(`  – ${dir}/ not present locally, skipping`);
      continue;
    }
    const files = walk(root);
    const bytes = files.reduce((s, f) => s + fs.statSync(path.join(root, f)).size, 0);
    console.log(`${dir}/ -> ${bucket}  (${files.length} files, ${(bytes / 2 ** 20).toFixed(1)} MB)`);

    if (!DRY) {
      const { error } = await supabase.storage.createBucket(bucket, { public: true });
      // "already exists" is the normal path on re-run; anything else is real.
      if (error && !/exist/i.test(error.message)) throw new Error(`createBucket ${bucket}: ${error.message}`);
    }

    let done = 0;
    await pool(files, CONCURRENCY, async (f) => {
      const buf = fs.readFileSync(path.join(root, f));
      const objectKey = `${dir}/${f}`;
      if (!DRY) {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(objectKey, buf, { contentType: contentType(buf, f), upsert: true });
        if (error) failures.push(`${objectKey}: ${error.message}`);
      }
      if (++done % 50 === 0 || done === files.length) {
        process.stdout.write(`\r  ${done}/${files.length}`);
      }
    });
    process.stdout.write("\n");
    totalFiles += files.length;
    totalBytes += bytes;
  }

  console.log(`\n${DRY ? "Would upload" : "Uploaded"} ${totalFiles} files, ${(totalBytes / 2 ** 20).toFixed(1)} MB`);
  if (failures.length) {
    console.error(`\n${failures.length} FAILED:`);
    for (const f of failures.slice(0, 10)) console.error(`  ${f}`);
    process.exit(1);
  }
  if (!DRY) console.log("Next: npm run seed  (rewrites the image URLs in the DB)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
