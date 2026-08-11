/**
 * Seed local Supabase from prisma/seed-data/*.json (produced by scripts/extract.ts).
 * Idempotent. Run: npm run seed
 */
import process from "node:process";
// Load .env.local first: loadEnvFile keeps the first value set, so this gives
// .env.local precedence over .env (standard Next.js env precedence).
try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { assetUrl } from "../lib/asset-url";
import { BRAND_NAME } from "../lib/brand";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env — set it before seeding`);
  return v;
};

// Plus-addressed on the house mailbox rather than an invented domain: these are only
// fallbacks for a fresh clone, and a plus-address is one that genuinely receives mail if a
// reset ever needs to reach it. Production sets ADMIN_EMAIL / DEMO_EMAIL explicitly.
const adminEmail = (process.env.ADMIN_EMAIL || "favetaahouse+admin@gmail.com").toLowerCase().trim();
const adminName = process.env.ADMIN_NAME || "Store Admin";
const demoEmail = (process.env.DEMO_EMAIL || "favetaahouse+demo@gmail.com").toLowerCase().trim();
// No fallbacks: the admin seeded below is a full super-admin, and .env is gitignored, so
// any default here would silently become the password on every fresh clone and CI run.
const adminPassword = requireEnv("ADMIN_PASSWORD");
const demoPassword = requireEnv("DEMO_PASSWORD");

const DIR = path.join(process.cwd(), "prisma", "seed-data");
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as T;
const NIL = "00000000-0000-0000-0000-000000000000";

type SeedVariant = {
  shopifyId: string; color: string; colorHex: string | null; size: string; sku: string | null;
  price: number; compareAt: number | null; available: boolean; imageUrl: string | null; position: number;
};
type SeedProduct = {
  handle: string; title: string; description: string | null; productCode: string | null;
  materials: string | null; modelSize: string | null; details: string | null; packaging: string | null;
  category: string; vendor: string; featured: boolean; onSale: boolean; priceMin: number; priceMax: number;
  images: string[]; variants: SeedVariant[];
};
type SeedCollection = { handle: string; title: string; kind: string; position: number; productHandles: string[] };

async function wipe() {
  // children first
  await supabase.from("product_collections").delete().neq("product_id", NIL);
  await supabase.from("cart_items").delete().neq("id", NIL);
  await supabase.from("order_items").delete().neq("id", NIL);
  await supabase.from("orders").delete().neq("id", NIL);
  await supabase.from("wishlist_items").delete().neq("id", NIL);
  await supabase.from("product_images").delete().neq("id", NIL);
  await supabase.from("variants").delete().neq("id", NIL);
  await supabase.from("products").delete().neq("id", NIL);
  await supabase.from("collections").delete().neq("id", NIL);
}

async function main() {
  const products = read<SeedProduct[]>("products.json");
  const collections = read<SeedCollection[]>("collections.json");

  console.log("Wiping catalog...");
  await wipe();

  console.log(`Seeding ${collections.length} collections...`);
  const { data: collRows, error: cErr } = await supabase
    .from("collections")
    .insert(collections.map((c) => ({ handle: c.handle, title: c.title, kind: c.kind, position: c.position })))
    .select("id, handle");
  if (cErr) throw cErr;
  const collMap = new Map(collRows!.map((r) => [r.handle, r.id]));

  console.log(`Seeding ${products.length} products...`);
  const { data: prodRows, error: pErr } = await supabase
    .from("products")
    .insert(
      products.map((p) => ({
        handle: p.handle, title: p.title, description: p.description, product_code: p.productCode,
        materials: p.materials, model_size: p.modelSize, details: p.details, packaging: p.packaging,
        category: p.category, vendor: BRAND_NAME, featured: p.featured, on_sale: p.onSale,
        price_min: p.priceMin, price_max: p.priceMax,
      })),
    )
    .select("id, handle");
  if (pErr) throw pErr;
  const prodMap = new Map(prodRows!.map((r) => [r.handle, r.id]));

  const variants = products.flatMap((p) =>
    p.variants.map((v) => ({
      product_id: prodMap.get(p.handle)!, shopify_id: v.shopifyId, color: v.color, color_hex: v.colorHex,
      size: v.size, sku: v.sku, price: v.price, compare_at: v.compareAt,
      stock: v.available ? 10 : 0,
      available: v.available, image_url: v.imageUrl ? assetUrl(v.imageUrl) : null, position: v.position,
    })),
  );
  // Seed data stores project-agnostic "/assets/..." keys; the DB stores the resolved
  // Storage URL, so re-seeding against another project just re-points them.
  const images = products.flatMap((p) =>
    p.images.map((url, i) => ({ product_id: prodMap.get(p.handle)!, url: assetUrl(url), alt: p.title, position: i })),
  );
  const links = collections.flatMap((c) =>
    c.productHandles
      .map((h, i) => ({ collectionId: collMap.get(c.handle), productId: prodMap.get(h), i }))
      .filter((x) => x.collectionId && x.productId)
      .map((x) => ({ collection_id: x.collectionId!, product_id: x.productId!, position: x.i })),
  );

  console.log(`Inserting ${variants.length} variants, ${images.length} images, ${links.length} links...`);
  for (const [table, rows] of [["variants", variants], ["product_images", images], ["product_collections", links]] as const) {
    // chunk to keep payloads reasonable
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + 500) as never);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  // Backfill each product's advisory total = sum of its size quantities.
  console.log("Setting product totals...");
  for (const p of products) {
    const id = prodMap.get(p.handle);
    if (!id) continue;
    const total = p.variants.reduce((s, v) => s + (v.available ? 10 : 0), 0);
    await supabase.from("products").update({ total_qty: total }).eq("id", id);
  }

  console.log("Seeding admin + demo users...");
  await supabase.from("users").upsert(
    [
      { email: adminEmail, name: adminName, role: "ADMIN", password: await bcrypt.hash(adminPassword, 10) },
      { email: demoEmail, name: "Demo Customer", role: "CUSTOMER", password: await bcrypt.hash(demoPassword, 10) },
    ],
    { onConflict: "email" },
  );

  // Roles are created by the migration; (re)seed their permission grants from the
  // code catalog and promote the admin user to super_admin.
  console.log("Seeding roles & permissions...");
  const { data: roleRows } = await supabase.from("roles").select("id, key");
  const roleByKey = new Map((roleRows ?? []).map((r) => [r.key, r.id]));
  if (roleByKey.size === 0) {
    console.warn("  ! no roles found — run the rbac_security migration (supabase db reset)");
  } else {
    const permRows: { role_id: string; permission: string }[] = [];
    const superId = roleByKey.get("super_admin");
    if (superId) for (const p of PERMISSIONS) permRows.push({ role_id: superId, permission: p });
    for (const [key, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const rid = roleByKey.get(key);
      if (rid) for (const p of perms) permRows.push({ role_id: rid, permission: p });
    }
    // Dedupe (role_id, permission) so a redundant catalog entry can't break the PK.
    const seen = new Set<string>();
    const uniqueRows = permRows.filter((r) => {
      const k = `${r.role_id}:${r.permission}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    await supabase.from("role_permissions").delete().in("role_id", [...roleByKey.values()]);
    for (let i = 0; i < uniqueRows.length; i += 500) {
      const { error } = await supabase.from("role_permissions").insert(uniqueRows.slice(i, i + 500));
      if (error) throw new Error(`role_permissions: ${error.message}`);
    }
    if (superId) await supabase.from("users").update({ role_id: superId }).eq("email", adminEmail);
    console.log(`  ✓ ${permRows.length} permission grants across ${roleByKey.size} roles`);
  }

  const { count: vCount } = await supabase.from("variants").select("*", { count: "exact", head: true });
  console.log(`\n✓ Done. ${products.length} products, ${vCount} variants, ${collections.length} collections.`);
  console.log(`  ${adminEmail}   (admin, password from ADMIN_PASSWORD)`);
  console.log(`  ${demoEmail}   (customer, password from DEMO_PASSWORD)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
