import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CONTENT, type Section } from "@/lib/content-schema";
import { assetUrl } from "@/lib/asset-url";
import { parseList, parseLengths } from "@/lib/variant-options";
import { parseMeasureFields, type MeasureField, type Unit } from "@/lib/measurements";
import { DEFAULT_CATEGORIES, normalizeCategory, sortCategoriesForNav } from "@/lib/categories";

/**
 * Read a CMS content section (content table merged over defaults).
 *
 * Cached into the prerendered shell: this is admin-edited copy that changes a few times
 * a month, not per visitor. Admin saves call updateTag("content") to expire it, so edits
 * still appear immediately — see lib/actions/content.ts.
 */
export async function getContent(section: Section): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  const { data } = await supabase.from("content").select("data").eq("key", section).maybeSingle();
  return { ...DEFAULT_CONTENT[section], ...((data?.data as Record<string, string>) ?? {}) };
}

export async function getSiteSettings() {
  return getContent("site-settings");
}

/** The homepage story band's copy and artwork. Every field may be blank — see getHomeStory. */
export type HomeStory = {
  title: string;
  heading: string;
  lead: string;
  body: string;
  cta: string;
  ctaHref: string;
  image: string;
};

/**
 * Shipped with the repo, so the band has artwork before the owner uploads any.
 *
 * NOT about-story.jpg, despite the name: most of public/assets/home/ was scraped and saved
 * with a .jpg extension over WebP/HEIF bytes, and that particular file is a 160×77 HEIF
 * thumbnail. Chrome refuses it outright, because static serving types it from the extension
 * and the bytes disagree. story.jpg is a real 1200×900 JPEG re-encoded for this slot.
 */
const DEFAULT_STORY_IMAGE = "/assets/home/story.jpg";

/**
 * The homepage story band, admin-editable via Admin → Content → Home Page.
 *
 * Returns "" for anything the owner has not set rather than an English default, because the
 * caller can then fall back to the *translated* string — a default baked in here would win
 * over the Arabic copy on /ar and quietly make the section monolingual. assetUrl resolves
 * "/assets/..." onto Storage and leaves pasted absolute URLs untouched.
 */
export async function getHomeStory(locale: string): Promise<HomeStory> {
  const c = await getContent("home");
  // `||`, not `??`: a field cleared in the admin is "" and must fall through to the other
  // language, then to the caller's translation.
  const bi = (key: string) =>
    (locale === "ar" ? c[`${key}_ar`] || c[key] : c[key] || c[`${key}_ar`] || "").trim();
  return {
    title: bi("trendyTitle"),
    heading: bi("storyHeading"),
    lead: bi("storyLead"),
    body: bi("storyBody"),
    cta: bi("storyCta"),
    ctaHref: (c.storyCtaHref ?? "").trim() || "/collections/all",
    image: assetUrl((c.storyImage ?? "").trim() || DEFAULT_STORY_IMAGE),
  };
}

/** The catalogue section's heading. Same blank-means-fall-back rule as getHomeStory. */
export async function getHomeSectionTitles(locale: string): Promise<{ trendy: string }> {
  const c = await getContent("home");
  const key = locale === "ar" ? c.trendyTitle_ar || c.trendyTitle : c.trendyTitle || c.trendyTitle_ar;
  return { trendy: (key ?? "").trim() };
}

/**
 * The homepage hero's media. Plain strings only — `"use cache"` serializes what crosses this
 * boundary and cannot handle a URL instance (next/dist/docs/.../directives/use-cache.md).
 */
export type HomeMedia = {
  /** The desktop cut, and the phone cut too when no separate mobile file is set. May be "". */
  src: string;
  /** Served under 768px. Falls back to `src`. */
  mobileSrc: string;
  /** The footage's mean colour, painted before any request answers. Never black. */
  bg: string;
  /** Media host to warm a connection to, or "" when nothing is remote. */
  origin: string;
};

/**
 * A neutral floor for a hero whose colour was never measured — an older row written before
 * heroBg existed, or a video uploaded from a browser that could not decode a frame. Mid-grey
 * reads as "image loading" under either a light or a dark clip; the brand's paper white would
 * flash against dark footage and #141414 is the black this hero must never show.
 */
const NEUTRAL_HERO_BG = "#9a999b";

/**
 * The homepage hero, admin-editable via Admin → Media (stored in the "home" content blob, so it
 * rides the same "content" cache tag as the rest of the CMS copy).
 *
 * Returns null when the owner has set nothing — a real state, not a missing one, and the reason
 * the schema defaults are blank. The homepage renders a plain band for it and the header keeps
 * its opaque treatment, so removing the video in the admin is a complete, coherent result rather
 * than a broken hero.
 */
export async function getHomeMedia(): Promise<HomeMedia | null> {
  const c = await getContent("home");
  const src = (c.heroVideo ?? "").trim();
  if (!src) return null;
  return {
    src,
    mobileSrc: (c.heroVideoMobile ?? "").trim() || src,
    bg: (c.heroBg ?? "").trim() || NEUTRAL_HERO_BG,
    origin: originOf(src),
  };
}

/** "" rather than a throw: a malformed or relative URL just means there is nothing to preconnect to. */
function originOf(u: string): string {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
}

export type CommerceSettings = {
  shippingFee: number; // QAR major units
  freeShippingThreshold: number; // QAR major units
  taxRate: number; // percent
  taxLabel: string;
  taxLabelAr: string;
  emailEnabled: boolean;
  emailSenderName: string;
  /** Blank falls back to the EMAIL_FROM env var — see lib/email.ts. */
  emailFromAddress: string;
  emailReplyTo: string;
};

/** Parsed commerce/payment settings (shipping, tax, order emails) from the CMS. */
export async function getCommerceSettings(): Promise<CommerceSettings> {
  const c = await getContent("commerce");
  const num = (k: string) => {
    const n = parseFloat(c[k] ?? "");
    return Number.isFinite(n) ? n : 0;
  };
  return {
    shippingFee: num("shippingFee"),
    freeShippingThreshold: num("freeShippingThreshold"),
    taxRate: num("taxRate"),
    taxLabel: c.taxLabel || "Tax",
    taxLabelAr: c.taxLabel_ar || "ضريبة",
    emailEnabled: c.emailEnabled !== "false",
    emailSenderName: c.emailSenderName || "FAVETAA",
    emailFromAddress: c.emailFromAddress || "",
    emailReplyTo: c.emailReplyTo || "",
  };
}

/** The floating button, the contact page and the form all link here — build it once. */
export async function getWhatsappUrl(): Promise<string> {
  const { whatsapp } = await getSiteSettings();
  return `https://wa.me/${(whatsapp || "").replace(/[^0-9]/g, "")}`;
}

/**
 * The admin-editable size + length lists (Admin → Content → Variant Options). Only the admin
 * needs these — the storefront derives a product's options from its actual variant rows.
 * Passed as props into the client admin forms (this module is server-only).
 */
export async function getVariantOptions(): Promise<{ sizes: string[]; lengths: number[] }> {
  const c = await getContent("variant-options");
  return { sizes: parseList(c.sizes), lengths: parseLengths(c.lengths) };
}

export type MadeToOrderSettings = {
  /** The house-wide measurement schema. A product narrows it via products.mto_fields. */
  fields: MeasureField[];
  leadMinDays: number;
  leadMaxDays: number;
  /** What the shopper's unit switch starts on. They can change it either way. */
  defaultUnit: Unit;
  intro: string;
  introAr: string;
  guide: string;
  guideAr: string;
  guideImage: string;
  notesLabel: string;
  notesLabelAr: string;
  returnsNote: string;
};

/**
 * The made-to-order schema and copy (Admin → Content → Made to Order).
 *
 * Unlike getVariantOptions this IS read by the storefront — the measurement form is generated
 * from it — so the product page awaits it alongside getVariantOptions. Both ride the same
 * "content" cache tag, so nothing new enters the cache graph.
 *
 * Every copy field returns "" when unset so the caller can fall back to its *translated*
 * string; an English default here would win over the Arabic on /ar. The one exception is the
 * field list, which ships with the house default because an empty measurement form is an
 * unsellable product rather than a monolingual one.
 */
export async function getMadeToOrderSettings(): Promise<MadeToOrderSettings> {
  const c = await getContent("made-to-order");
  const days = (k: string, fallback: number) => {
    const n = parseInt(c[k] ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const leadMinDays = days("leadMinDays", 14);
  return {
    fields: parseMeasureFields(c.measureFields),
    leadMinDays,
    // An inverted range would render "ready in 21–14 days". Clamp rather than reject: the
    // owner typing the two boxes out of order should not take the product page down.
    leadMaxDays: Math.max(days("leadMaxDays", 21), leadMinDays),
    defaultUnit: c.unitInches === "true" ? "in" : "cm",
    intro: c.intro || "",
    introAr: c.intro_ar || "",
    guide: c.guide || "",
    guideAr: c.guide_ar || "",
    guideImage: c.guideImage ? assetUrl(c.guideImage) : "",
    notesLabel: c.notesLabel || "",
    notesLabelAr: c.notesLabel_ar || "",
    returnsNote: c.returnsNote || "",
  };
}

/**
 * The category options the admin product form offers. Categories are dynamic — the list is
 * the categories products actually use, unioned with the built-in defaults so the picker is
 * never empty. Admin-only; the storefront derives its category nav from the same product data.
 * Order: the built-in four first (abaya-first), then any admin-added categories alphabetically.
 */
export async function getProductCategories(): Promise<string[]> {
  const { data } = await supabase.from("products").select("category");
  const used = new Set((data ?? []).map((r) => normalizeCategory(r.category as string)));
  const defaults = DEFAULT_CATEGORIES as readonly string[];
  const extra = sortCategoriesForNav([...used].filter((c) => c && !defaults.includes(c)));
  return [...defaults, ...extra];
}
