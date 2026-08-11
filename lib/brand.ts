/**
 * The brand name, in one place.
 *
 * This exists because the store was rebranded once and the old name survived in the least
 * visible spot possible: the `products.vendor` column DEFAULT. Neither the admin create form
 * nor the bulk importer sends a vendor, so every product made after the rebrand would have
 * silently inherited the old brand from the database — invisible in the UI, wrong in every
 * export and feed.
 *
 * So the rule is: code WRITES this constant, it never relies on the column default. The default
 * is still correct (see supabase/migrations/20260811120000_favetaa_rebrand.sql), but it is now
 * only a backstop rather than the source of truth.
 *
 * Display copy lives in messages/{en,ar}.json under `brand.name` — that one is translatable.
 * This constant is the machine-readable value that goes into the database and structured data.
 */
export const BRAND_NAME = "FAVETAA";
