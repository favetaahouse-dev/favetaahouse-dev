import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CONTENT, type Section } from "@/lib/content-schema";
import { assetUrl } from "@/lib/asset-url";
import { parseList, parseLengths } from "@/lib/variant-options";
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

/**
 * Homepage video sources (hero + campaign), admin-editable, with baked-in fallbacks.
 * assetUrl resolves "/assets/video/..." onto Supabase Storage and leaves the full URLs
 * an admin may paste in untouched.
 */
export async function getHomeMedia() {
  const c = await getContent("home");
  return {
    heroVideo: assetUrl(c.heroVideo || "/assets/video/hero.mp4"),
  };
}

/**
 * Homepage gallery images, admin-editable (Admin → Media). Stored as a newline-joined
 * string in the "home" content blob — the string-only content model has no array field,
 * so this mirrors the delimited-list convention (see the "list" field kind). assetUrl
 * resolves "/assets/..." onto Storage and leaves pasted absolute URLs untouched.
 */
export async function getHomeGallery(): Promise<string[]> {
  const c = await getContent("home");
  return (c.gallery ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(assetUrl);
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
    emailSenderName: c.emailSenderName || "Alessia Abaya",
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
