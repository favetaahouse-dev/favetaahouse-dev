/**
 * Extraction pipeline: parse the scraped Shopify storefront in ./scrape-src into
 * a normalized seed dataset (prisma/seed-data/*.json) and copy referenced assets
 * into ./public/assets. Idempotent — safe to re-run.
 *
 * Run: npm run extract
 */
import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "node:path";

const ROOT = process.cwd();
// scrape-src lives outside the Next.js watched tree (parent dir) to keep dev fast,
// but fall back to an in-project copy if present.
const SRC = fs.existsSync(path.join(ROOT, "scrape-src"))
  ? path.join(ROOT, "scrape-src")
  : path.join(ROOT, "..", "scrape-src");
const ASSETS = path.join(SRC, "_assets");
const SHOP_FILES = path.join(ASSETS, "www.alessiaabaya.com", "cdn", "shop", "files");
const PRODUCTS_DIR = path.join(SRC, "products");
const COLLECTIONS_DIR = path.join(SRC, "collections");
const PUB = path.join(ROOT, "public", "assets");
const SEED_OUT = path.join(ROOT, "prisma", "seed-data");

// Homepage "EXPLORE THE CREATION" carousel order (also flags featured).
const FEATURED_HANDLES = [
  "5012a5435eb1", "5012a5475ee1", "5012a5441eb2", "5012a5466sb1", "5012a5450he1",
  "5012a5535eb1", "5012a5533ee1", "5012a5437he1", "5012a5469he2", "5012a5438hb1",
  "5012a5442ea1", "5012a5422ee1", "5012a5441eb1", "5012a5476eb1", "5012a5301ea1",
  "5012a5395sb1", "5012a5304ea1", "5012a5455sb1", "5012a5469he1", "5012a5465sb1",
  "5012a5395sb2", "5012a5468eb1", "5012a5449eb1",
];

type VariantOut = {
  shopifyId: string;
  color: string;
  colorHex: string | null;
  size: string;
  sku: string | null;
  price: number;
  compareAt: number | null;
  available: boolean;
  imageUrl: string | null;
  position: number;
};

type ProductOut = {
  handle: string;
  title: string;
  description: string | null;
  productCode: string | null;
  materials: string | null;
  modelSize: string | null;
  details: string | null;
  packaging: string | null;
  category: "ABAYA" | "JALABIYA" | "SHEILA" | "OTHER";
  vendor: string;
  featured: boolean;
  onSale: boolean;
  priceMin: number;
  priceMax: number;
  images: string[];
  variants: VariantOut[];
};

// ---------- helpers ----------

/** strip trailing "-q<hash>" before extension so resolution variants dedupe. */
function baseName(file: string): string {
  const ext = path.extname(file);
  const stem = path.basename(file, ext);
  return stem.replace(/-q[0-9a-f]{6,}$/i, "");
}

/**
 * The scrape holds ~4.8 resolution variants of every photo (9KB thumb .. 3.3MB full),
 * which is 535MB for 446 photos. We keep one median-sized variant each and point the
 * seed at it; `variantKey` groups a filename with its siblings.
 */
function variantKey(file: string): string {
  return file.replace(/-q[0-9a-f]+\.[A-Za-z0-9]+$/i, "");
}

/** filename of the kept variant, by "<dir>|<variantKey>". Filled by copyAssets(). */
const keptByGroup = new Map<string, string>();

const groupId = (relDir: string, file: string) => `${relDir}|${variantKey(file)}`;

/** rewrite any /assets/files url onto the variant we actually kept on disk. */
function resolveKept(url: string): string {
  const m = url.match(/^\/assets\/files\/(?:(.*)\/)?([^/]+)$/);
  if (!m) return url;
  const kept = keptByGroup.get(groupId(m[1] ?? "", m[2]));
  if (!kept) return url;
  return `/assets/files/${m[1] ? `${m[1]}/` : ""}${kept}`;
}

/** local `../_assets/.../shop/files/<name>` src -> public url `/assets/files/<name>`. */
function toPublicFilesUrl(src: string): string | null {
  const m = src.match(/\/files\/([^"'?]+\.(?:jpg|jpeg|png|webp|gif|svg))/i);
  if (!m) return null;
  return `/assets/files/${m[1]}`;
}

/** last path segment of a CDN url (drops query). */
function fileFromCdn(src: string): string | null {
  const m = src.match(/\/files\/([^"'?]+)/i);
  return m ? m[1] : null;
}

function normalizeCategory(raw: string, handle: string): ProductOut["category"] {
  const v = (raw || "").toUpperCase();
  if (v.includes("JALAB")) return "JALABIYA";
  if (v.includes("SHEILA") || v.includes("SHAYLA") || v.includes("SHAILA")) return "SHEILA";
  if (v.includes("ABAYA")) return "ABAYA";
  const h = handle.toLowerCase();
  if (h.includes("sheila") || h.startsWith("s3")) return "SHEILA";
  if (h.includes("jalab") || h.includes("liberty")) return "JALABIYA";
  return "ABAYA";
}

async function copyFirstMatch(dirs: string[], re: RegExp, dest: string): Promise<boolean> {
  for (const dir of dirs) {
    if (!(await fs.pathExists(dir))) continue;
    const names = await fs.readdir(dir);
    const hit = names.find((n) => re.test(n));
    if (hit) {
      await fs.ensureDir(path.dirname(dest));
      await fs.copy(path.join(dir, hit), dest, { overwrite: true });
      return true;
    }
  }
  console.warn(`  ! no match for ${re} -> ${path.relative(ROOT, dest)}`);
  return false;
}

/** recursively find first file whose name matches regex. */
async function findFile(dir: string, re: RegExp): Promise<string | null> {
  if (!(await fs.pathExists(dir))) return null;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const found = await findFile(full, re);
      if (found) return found;
    } else if (re.test(e.name)) {
      return full;
    }
  }
  return null;
}

// ---------- asset copy ----------

/**
 * Copy shop/files, keeping only the median-sized variant of each photo. Files with no
 * "-q<hash>" sibling (svg icons, fonts) are their own group of one and always survive.
 */
async function copyShopFiles() {
  const destRoot = path.join(PUB, "files");
  let kept = 0;
  let kb = 0;

  const walk = async (relDir: string) => {
    const srcDir = path.join(SHOP_FILES, relDir);
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    const groups = new Map<string, { size: number; file: string }[]>();
    for (const e of entries) {
      if (e.isDirectory()) {
        await walk(path.join(relDir, e.name));
        continue;
      }
      const { size } = await fs.stat(path.join(srcDir, e.name));
      const g = groups.get(variantKey(e.name)) ?? [];
      g.push({ size, file: e.name });
      groups.set(variantKey(e.name), g);
    }

    await fs.ensureDir(path.join(destRoot, relDir));
    for (const [key, variants] of groups) {
      // sort by size, then name so the pick is deterministic across runs
      variants.sort((a, b) => a.size - b.size || a.file.localeCompare(b.file));
      const pick = variants[Math.floor(variants.length / 2)];
      keptByGroup.set(`${relDir}|${key}`, pick.file);
      await fs.copy(path.join(srcDir, pick.file), path.join(destRoot, relDir, pick.file), { overwrite: true });
      kept++;
      kb += pick.size / 1024;
    }
  };

  await walk("");
  console.log(`  ✓ shop/files -> public/assets/files (${kept} files, ${(kb / 1024).toFixed(1)} MB, median variant each)`);
}

async function copyAssets() {
  console.log("Copying assets...");
  // 1. all shop/files (product + home images, brand, svg icons, fonts live here)
  await fs.ensureDir(PUB);
  await copyShopFiles();

  // 2. payment icons
  const payDir = path.join(ASSETS, "www.alessiaabaya.com", "cdn", "shopifycloud", "storefront", "assets", "payment_icons");
  await copyFirstMatch([payDir], /american_express/, path.join(PUB, "payment", "amex.svg"));
  await copyFirstMatch([payDir], /apple_pay/, path.join(PUB, "payment", "apple-pay.svg"));
  await copyFirstMatch([payDir], /benefit/, path.join(PUB, "payment", "benefit.svg"));
  await copyFirstMatch([payDir], /^master/, path.join(PUB, "payment", "mastercard.svg"));
  await copyFirstMatch([payDir], /^visa/, path.join(PUB, "payment", "visa.svg"));

  // 3. fonts -> clean names
  const quickDir = path.join(ASSETS, "www.alessiaabaya.com", "cdn", "fonts", "quicksand");
  await copyFirstMatch([SHOP_FILES], /^MYRIADPRO-REGULAR/i, path.join(PUB, "fonts", "myriadpro-regular.woff"));
  await copyFirstMatch([SHOP_FILES], /^MyriadPro-Light/i, path.join(PUB, "fonts", "myriadpro-light.woff"));
  await copyFirstMatch([SHOP_FILES], /^MYRIADPRO-SEMIBOLD/i, path.join(PUB, "fonts", "myriadpro-semibold.woff"));
  await copyFirstMatch([SHOP_FILES], /^MYRIADPRO-BOLD/i, path.join(PUB, "fonts", "myriadpro-bold.woff"));
  await copyFirstMatch([quickDir], /^quicksand_n4\..*\.woff2$/i, path.join(PUB, "fonts", "quicksand-400.woff2"));
  await copyFirstMatch([quickDir], /^quicksand_n5\..*\.woff2$/i, path.join(PUB, "fonts", "quicksand-500.woff2"));
  await copyFirstMatch([quickDir], /^quicksand_n7\..*\.woff2$/i, path.join(PUB, "fonts", "quicksand-700.woff2"));
  await copyFirstMatch([SHOP_FILES], /^Janna_LT_Bold.*\.woff2$/i, path.join(PUB, "fonts", "janna-bold.woff2"));
  await copyFirstMatch([SHOP_FILES], /^JannaLT-Regular.*\.woff$/i, path.join(PUB, "fonts", "janna-regular.woff"));
  console.log("  ✓ fonts -> public/assets/fonts");

  // 4. brand + home + icon named assets
  // Prefer the exact hashed filename, but fall back to any Logo_2-*.png — the hash changes
  // whenever the asset is re-uploaded, and the fallback must not run when the exact hit lands.
  const logoDark = path.join(PUB, "brand", "logo-dark.png");
  if (!(await copyFirstMatch([SHOP_FILES], /^Logo_2-q2f906681\.png$/i, logoDark))) {
    await copyFirstMatch([SHOP_FILES], /^Logo_2-.*\.png$/i, logoDark);
  }
  await copyFirstMatch([SHOP_FILES], /^white-logo-.*\.png$/i, path.join(PUB, "brand", "logo-white.png"));

  const waSrc = await findFile(path.join(ASSETS, "cdn.shopify.com"), /^whatsapp_1-.*\.png$/i);
  if (waSrc) {
    await fs.ensureDir(path.join(PUB, "brand"));
    await fs.copy(waSrc, path.join(PUB, "brand", "whatsapp.png"), { overwrite: true });
  }

  await copyFirstMatch([SHOP_FILES], /^pic-web\.jpg_1-.*\.jpg$/i, path.join(PUB, "home", "travel-1.jpg"));
  await copyFirstMatch([SHOP_FILES], /^pic-web2_jpg-.*\.jpg$/i, path.join(PUB, "home", "travel-2.jpg"));
  await copyFirstMatch([SHOP_FILES], /^1-galary-.*\.jpg$/i, path.join(PUB, "home", "gallery-1.jpg"));
  await copyFirstMatch([SHOP_FILES], /^2galary-.*\.jpg$/i, path.join(PUB, "home", "gallery-2.jpg"));
  await copyFirstMatch([SHOP_FILES], /^3galary-.*\.jpg$/i, path.join(PUB, "home", "gallery-3.jpg"));
  await copyFirstMatch([SHOP_FILES], /^4galary-.*\.jpg$/i, path.join(PUB, "home", "gallery-4.jpg"));
  await copyFirstMatch([SHOP_FILES], /^lookbook_47_1-.*\.jpg$/i, path.join(PUB, "home", "lookbook.jpg"));
  await copyFirstMatch([SHOP_FILES], /^website-data-edit-our-story.*\.jpg$/i, path.join(PUB, "home", "about-story.jpg"));
  await copyFirstMatch([SHOP_FILES], /^Our-material_1.*\.jpg$/i, path.join(PUB, "home", "our-material.jpg"));
  await copyFirstMatch([SHOP_FILES], /^craftman.*\.jpg$/i, path.join(PUB, "home", "craftman.jpg"));
  await copyFirstMatch([SHOP_FILES], /^tag-2-svgrepo-com-.*\.svg$/i, path.join(PUB, "icon", "why-guarantee.svg"));
  await copyFirstMatch([SHOP_FILES], /^star-svgrepo-com_3-.*\.svg$/i, path.join(PUB, "icon", "why-fabric.svg"));
  await copyFirstMatch([SHOP_FILES], /^box-svgrepo-com-.*\.svg$/i, path.join(PUB, "icon", "why-shipping.svg"));
  console.log("  ✓ brand/home/icon named assets");
}

// ---------- product parsing ----------

/**
 * The variant objects Shopify inlines into the product page. Only the fields this scraper
 * reads are declared; everything is optional because the payload is scraped, not typed at
 * the source, and a missing field must fall through to the defaults below rather than throw.
 */
type ShopifyVariant = {
  id?: string | number;
  option1?: string | null;
  option2?: string | null;
  sku?: string | null;
  price?: string | number;
  compare_at_price?: string | number | null;
  available?: boolean;
  featured_image?: { src?: string } | null;
  featured_media?: { preview_image?: { src?: string } | null } | null;
};

function parseProduct(handle: string, html: string): ProductOut | null {
  const $ = cheerio.load(html);

  // variants JSON
  const raw = $("script[data-variant-picker-variants]").first().text().trim();
  if (!raw) {
    console.warn(`  ! ${handle}: no variant JSON, skipping`);
    return null;
  }
  let vjson: ShopifyVariant[];
  try {
    vjson = JSON.parse(raw);
  } catch {
    console.warn(`  ! ${handle}: variant JSON parse failed, skipping`);
    return null;
  }
  if (!Array.isArray(vjson) || vjson.length === 0) return null;

  // color -> hex map
  const colorHex: Record<string, string> = {};
  $("[data-color-swatches-picker-label]").each((_, el) => {
    const name = ($(el).attr("data-value") || "").trim();
    const hex = $(el).find("shape-swatch").first().attr("data-color");
    if (name && hex) colorHex[name] = hex.toUpperCase();
  });

  // gallery images (main carousel only), dedupe by base name preserving order
  const images: string[] = [];
  const seen = new Set<string>();
  $("product-media-carousel").first().find("img.product-media__image").each((_, el) => {
    const src = $(el).attr("src") || "";
    const url = toPublicFilesUrl(src);
    if (!url) return;
    const key = baseName(url);
    if (seen.has(key)) return;
    seen.add(key);
    // the scraped html points at a ~3KB thumbnail; use the variant we kept instead
    images.push(resolveKept(url));
  });

  // map a variant featured_image (cdn base) -> public files url present in gallery
  const galleryByBase = new Map<string, string>();
  for (const u of images) galleryByBase.set(baseName(u), u);

  // variants
  const variants: VariantOut[] = vjson.map((v, i) => {
    let imageUrl: string | null = null;
    const fsrc: string | undefined = v.featured_image?.src || v.featured_media?.preview_image?.src;
    if (fsrc) {
      const f = fileFromCdn(fsrc);
      if (f) imageUrl = galleryByBase.get(baseName(f)) ?? resolveKept(`/assets/files/${f.replace(/\?.*$/, "")}`);
    }
    return {
      shopifyId: String(v.id),
      color: String(v.option1 ?? "Default"),
      colorHex: colorHex[String(v.option1 ?? "").trim()] ?? null,
      size: String(v.option2 ?? "One Size"),
      sku: v.sku || null,
      price: Number(v.price) || 0,
      compareAt: v.compare_at_price != null ? Number(v.compare_at_price) : null,
      available: !!v.available,
      imageUrl,
      position: i,
    };
  });

  // title: h1 first line -> <title> -> handle
  let title = ($("h1.h2").first().text() || "").split("\n")[0].trim();
  if (!title) {
    title = ($("title").first().text() || "").replace(/\s*[–-]\s*ALESSIA ABAYA.*$/i, "").trim();
  }
  if (!title) title = handle;

  // accordion fields
  const faq: Record<string, string> = {};
  $(".faq-item").each((_, el) => {
    const q = $(el).find(".faq-question").first().text().trim();
    const a = $(el).find(".faq-answer").first().text().replace(/\s+/g, " ").trim();
    if (q && a && !faq[q]) faq[q] = a;
  });
  const productCodeRaw = faq["Product Code"] || null;
  const productCode = productCodeRaw ? productCodeRaw.split("|")[0].trim() : null;

  // category from analytics/initData
  const catMatch = html.match(/"category":"([^"]*)"/);
  const category = normalizeCategory(catMatch?.[1] || "", handle);

  const prices = variants.map((v) => v.price);
  const onSale = variants.some((v) => v.compareAt != null && v.compareAt > v.price);

  return {
    handle,
    title,
    description: faq["Description"] || null,
    productCode,
    materials: faq["Materials"] || null,
    modelSize: faq["Model Size & Height"] || faq["Model Size"] || null,
    details: faq["Details"] || null,
    packaging: faq["Packaging"] || null,
    category,
    vendor: "ALESSIA ABAYA",
    featured: FEATURED_HANDLES.includes(handle),
    onSale,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    images,
    variants,
  };
}

// ---------- collections ----------

const COLLECTION_META: Record<string, { title: string; kind: string; position: number }> = {
  "travel-collection": { title: "Travel Collection", kind: "FEATURE", position: 1 },
  sales: { title: "Sale", kind: "SALE", position: 2 },
  abayas: { title: "Abayas", kind: "CATEGORY", position: 3 },
  jalabiyas: { title: "Jalabiyas", kind: "CATEGORY", position: 4 },
  "view-all": { title: "View All", kind: "FEATURE", position: 5 },
  all: { title: "Shop", kind: "FEATURE", position: 6 },
};

async function parseCollections(validHandles: Set<string>) {
  const out: { handle: string; title: string; kind: string; position: number; productHandles: string[] }[] = [];
  const files = (await fs.pathExists(COLLECTIONS_DIR)) ? await fs.readdir(COLLECTIONS_DIR) : [];
  for (const file of files) {
    if (!file.endsWith(".html")) continue;
    const handle = path.basename(file, ".html");
    const html = await fs.readFile(path.join(COLLECTIONS_DIR, file), "utf8");
    const $ = cheerio.load(html);
    const handles = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/products\/([^/"'?#]+)\.html/);
      if (m && validHandles.has(m[1])) handles.add(m[1]);
    });
    const meta = COLLECTION_META[handle] || { title: handle, kind: "FEATURE", position: 99 };
    out.push({ handle, ...meta, productHandles: [...handles] });
  }
  // ensure all nav collections exist even if not scraped
  const navExtra: Record<string, { title: string; kind: string }> = {
    sheilas: { title: "Sheilas", kind: "CATEGORY" },
    "new-in": { title: "New In", kind: "FEATURE" },
    liberty: { title: "Liberty", kind: "FEATURE" },
    "daily-abayas": { title: "Daily Abayas", kind: "CATEGORY" },
    "evening-abayas": { title: "Evening Abayas", kind: "CATEGORY" },
    "daily-jalabiyas": { title: "Daily Jalabiyas", kind: "CATEGORY" },
    "evening-jalabiyas": { title: "Evening Jalabiyas", kind: "CATEGORY" },
    "pre-winter": { title: "Pre-Winter", kind: "SEASONAL" },
    "winter-2025": { title: "Winter", kind: "SEASONAL" },
    "ramadan-2026": { title: "Ramadan Collection", kind: "SEASONAL" },
    "eid-collection": { title: "Eid Collection", kind: "SEASONAL" },
    "black-collection": { title: "Black Collection", kind: "SEASONAL" },
    "eid-al-adha-collection-2026": { title: "Eid Al-Adha 2026", kind: "SEASONAL" },
  };
  for (const [handle, meta] of Object.entries(navExtra)) {
    if (!out.find((c) => c.handle === handle)) {
      out.push({ handle, title: meta.title, kind: meta.kind, position: 20, productHandles: [] });
    }
  }
  return out;
}

// ---------- main ----------

async function main() {
  console.log("ALESSIA ABAYA extraction\n");
  await fs.ensureDir(SEED_OUT);

  await copyAssets();

  console.log("\nParsing products...");
  const files = (await fs.readdir(PRODUCTS_DIR)).filter((f) => f.endsWith(".html"));
  const products: ProductOut[] = [];
  const globalColors: Record<string, string> = {};
  let lowImage = 0;
  for (const file of files) {
    const handle = path.basename(file, ".html");
    const html = await fs.readFile(path.join(PRODUCTS_DIR, file), "utf8");
    const p = parseProduct(handle, html);
    if (!p) continue;
    for (const v of p.variants) if (v.colorHex) globalColors[v.color] = v.colorHex;
    if (p.images.length <= 1) {
      lowImage++;
      console.warn(`  ! ${handle}: only ${p.images.length} image(s)`);
    }
    products.push(p);
  }

  const collections = await parseCollections(new Set(products.map((p) => p.handle)));

  await fs.writeJson(path.join(SEED_OUT, "products.json"), products, { spaces: 2 });
  await fs.writeJson(path.join(SEED_OUT, "collections.json"), collections, { spaces: 2 });
  await fs.writeJson(path.join(SEED_OUT, "color-map.json"), globalColors, { spaces: 2 });

  const catCount = products.reduce<Record<string, number>>((a, p) => ((a[p.category] = (a[p.category] || 0) + 1), a), {});
  console.log(`\n✓ Extracted ${products.length} products`);
  console.log(`  categories: ${JSON.stringify(catCount)}`);
  console.log(`  onSale: ${products.filter((p) => p.onSale).length}`);
  console.log(`  low-image products: ${lowImage}`);
  console.log(`  collections: ${collections.length}`);
  console.log(`  colors: ${Object.keys(globalColors).length}`);
  console.log(`\nSeed data -> prisma/seed-data/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
