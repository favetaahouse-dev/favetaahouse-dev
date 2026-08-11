/**
 * One-off, idempotent migration: strip the competitor's name from product image assets.
 * The scrape preserved upload filenames like `ALMOTAHAJIBA53612_...jpg`, and those names
 * flow into three coupled places — this rewrites all three so no live image URL carries it:
 *
 *   1. prisma/seed-data/products.json  (the in-repo source of truth for future reseeds)
 *   2. Supabase Storage object keys     (product-images/files/<name>) — moved in place
 *   3. the baked absolute URLs already in the DB (product_images.url, variants.image_url)
 *
 * It deliberately does NOT reseed: `npm run seed` wipes orders/carts, which would destroy
 * live customer data. The DB is updated in place instead.
 *
 * Rename rule: `almotahajiba` -> `alessia` (case-insensitive), rest of the filename kept.
 *
 * Run: npm run rename-assets              (applies the migration)
 *      npm run rename-assets -- --dry-run (prints the plan + collision check, changes nothing)
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
import { assetKey } from "../lib/asset-url";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const DRY = process.argv.includes("--dry-run");
const TOKEN = /almotahajiba/gi;
const SEED = path.join(process.cwd(), "prisma", "seed-data", "products.json");

type SeedVariant = { imageUrl: string | null; [k: string]: unknown };
type SeedProduct = { images: string[]; variants: SeedVariant[]; [k: string]: unknown };

const rename = (p: string) => p.replace(TOKEN, "alessia");

async function main() {
  console.log(`${DRY ? "[dry run] " : ""}Renaming almotahajiba -> alessia across seed, Storage, and DB\n`);

  // ── 1. gather every affected asset path from the seed ──────────────────────
  const products = JSON.parse(fs.readFileSync(SEED, "utf8")) as SeedProduct[];
  const allPaths = new Set<string>();
  const affected = new Set<string>();
  for (const p of products) {
    for (const img of p.images ?? []) {
      allPaths.add(img);
      if (TOKEN.test(img)) affected.add(img);
      TOKEN.lastIndex = 0;
    }
    for (const v of p.variants ?? []) {
      if (!v.imageUrl) continue;
      allPaths.add(v.imageUrl);
      if (TOKEN.test(v.imageUrl)) affected.add(v.imageUrl);
      TOKEN.lastIndex = 0;
    }
  }

  if (affected.size === 0) {
    console.log("Nothing to rename — seed data is already clean. (Safe to have re-run.)");
    return;
  }

  // ── 2. build old->new map and prove it's safe (no collisions) ──────────────
  const map = [...affected].map((oldP) => ({ oldP, newP: rename(oldP) }));
  const newSet = new Set<string>();
  for (const { oldP, newP } of map) {
    if (newSet.has(newP)) throw new Error(`collision: two sources map to ${newP}`);
    newSet.add(newP);
    // a renamed target must not clash with an unrelated existing filename
    if (allPaths.has(newP)) throw new Error(`collision: ${oldP} -> ${newP} already exists in seed`);
  }
  console.log(`  ${map.length} unique asset path(s) to rename. Collision check passed.\n`);

  // ── 3. move the Storage objects (idempotent) ───────────────────────────────
  let moved = 0;
  let skipped = 0;
  for (const { oldP, newP } of map) {
    const from = assetKey(oldP);
    const to = assetKey(newP);
    if (!from || !to) {
      console.warn(`  ! not a Storage-backed path, skipping: ${oldP}`);
      continue;
    }
    if (DRY) {
      console.log(`  move  ${from.bucket}/${from.key}  ->  ${to.key}`);
      continue;
    }
    const { error } = await supabase.storage.from(from.bucket).move(from.key, to.key);
    if (error) {
      // Already-moved (old missing) or already-present target: treat as done on re-runs.
      if (/not found|exist/i.test(error.message)) skipped++;
      else console.warn(`  ! move failed ${from.key}: ${error.message}`);
    } else {
      moved++;
    }
  }
  if (!DRY) console.log(`  Storage: ${moved} moved, ${skipped} already done.`);

  // ── 4. update baked URLs in the DB IN PLACE (never wipe) ───────────────────
  // Match on the live URL substring so this is robust to whatever base the DB was
  // seeded with, then rewrite the token in the fetched value.
  for (const [table, col] of [["product_images", "url"], ["variants", "image_url"]] as const) {
    const { data, error } = await supabase.from(table).select(`id, ${col}`).ilike(col, "%almotahajiba%");
    if (error) throw new Error(`${table} read: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string } & Record<string, string | null>>;
    if (DRY) {
      console.log(`  DB ${table}.${col}: ${rows.length} row(s) would be updated.`);
      continue;
    }
    let n = 0;
    for (const row of rows) {
      const current = row[col];
      if (!current) continue;
      const next = current.replace(TOKEN, "alessia");
      const { error: uErr } = await supabase.from(table).update({ [col]: next }).eq("id", row.id);
      if (uErr) console.warn(`  ! ${table} ${row.id}: ${uErr.message}`);
      else n++;
    }
    console.log(`  DB ${table}.${col}: ${n} row(s) updated.`);
  }

  // ── 5. rewrite the seed file so future reseeds stay clean ──────────────────
  const before = fs.readFileSync(SEED, "utf8");
  const after = before.replace(TOKEN, "alessia");
  if (DRY) {
    const count = (before.match(TOKEN) ?? []).length;
    console.log(`  seed products.json: ${count} occurrence(s) would be rewritten.`);
  } else if (after !== before) {
    fs.writeFileSync(SEED, after);
    console.log("  seed products.json: rewritten.");
  }

  console.log(`\n${DRY ? "Dry run complete — nothing changed." : "Done."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
