# FAVETAA — Full-stack storefront (Supabase + ryzo conventions)

A production-grade, self-owned store for **FAVETAA**, a Qatari modest-fashion house (abayas &
jalabiyas), aligned to the **ryzo-website** project's structure, translation method, and
admin-panel style.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-first `@theme` in `app/globals.css`) |
| Data | **Supabase** — Postgres + PostgREST + RPC |
| Media | **Supabase Storage** — product imagery (`product-images`) and admin uploads (`media`); the repo ships no product media |
| Auth | Auth.js (NextAuth v5), JWT credentials backed by the Supabase `users` table, roles `CUSTOMER`/`ADMIN` |
| Payments | **SkipCash** (Qatar gateway, QAR-native) with a demo fallback |
| i18n | next-intl v4, `localePrefix: "as-needed"` — English **unprefixed**, Arabic `/ar`, full RTL |
| Admin | `app/admin` (outside `[locale]`), ryzo-style dark-luxury console, REST `app/api/admin/**` |

## Getting started

```bash
npm install

# 1. Local Supabase (Docker required) — API :54321, DB :54322, Studio :54323
npx supabase start
#    copy the printed SERVICE_ROLE_KEY / ANON_KEY into .env (already set for the default local keys)
npx supabase db reset            # applies supabase/migrations (schema + RPCs)
npm run db:types                 # regenerate lib/database.types.ts

# 2. Upload product media to Supabase Storage (idempotent; --dry-run to preview)
npm run upload-assets            # -> product-images + media buckets

# 3. Seed (reads prisma/seed-data/*.json → Supabase)
npm run seed                     # 25 products, 150 variants, 19 collections, admin + demo users

# 4. Run
npm run dev                      # http://localhost:3000  (/ = English, /ar = Arabic)
```

### Where media lives
Product imagery is **not in this repo** — it lives in Supabase Storage. Seed data keeps
brand-agnostic `/assets/files/…` keys; `lib/asset-url.ts` resolves them onto the current project's
Storage URL, and `npm run seed` writes the resolved URL into the DB. Point `.env` at a different
Supabase project and re-run `upload-assets` + `seed` and everything re-points itself.

Site chrome (brand, favicon, icons, payment marks, fonts, home imagery — ~1MB) stays in `public/`,
so first paint never waits on a cross-origin fetch.

### Logins
Set in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, `DEMO_EMAIL` / `DEMO_PASSWORD`) and seeded into the
`users` table by `npm run seed` — change them and re-seed to update. There are no default passwords:
`npm run seed` fails if `ADMIN_PASSWORD` / `DEMO_PASSWORD` are unset.
- **Admin:** `ADMIN_EMAIL` / `ADMIN_PASSWORD` → `/admin` (full super-admin)
- **Customer:** `DEMO_EMAIL` / `DEMO_PASSWORD`

### Environment (`.env`)
Production needs exactly **four**: `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (the whole database
config — every query is server-side service-role, so the anon key is unused), `AUTH_SECRET`, and
`NEXT_PUBLIC_SITE_URL` (payment returns, email links, sitemap, `metadataBase`).

Optional, blank = feature off:
`SKIPCASH_ENV` / `SKIPCASH_CLIENT_ID` / `SKIPCASH_KEY_ID` / `SKIPCASH_KEY_SECRET` / `SKIPCASH_WEBHOOK_KEY`
(blank → checkout runs in **demo mode**) and `RESEND_API_KEY` (blank → emails skipped).

**Meta Pixel / Conversions API** — `NEXT_PUBLIC_META_PIXEL_ID` (blank → no script, no events,
nothing), `META_CAPI_ACCESS_TOKEN` (blank → browser pixel still works, server-side sending off),
`META_CAPI_TEST_EVENT_CODE` (**never set in production** — it routes every event to the Test
Events stream where it counts for nothing; `lib/meta/capi.ts` refuses it when `VERCEL_ENV=production`)
and `META_DOMAIN_VERIFICATION` (only if verifying by meta tag instead of DNS TXT).
See [`lib/meta/`](./lib/meta/) — one payload builder shared by the browser and server halves so
`content_ids`/`value` cannot drift, and `npm run meta:test` to prove the token before shipping.

Locally, `npx supabase start` also sets `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
neither is needed in production.

**Not env vars.** Anything the store owner should change without a redeploy — contact email, WhatsApp
number, store location, socials, email sender name / from-address / reply-to — lives in
**Admin → Content** ([`lib/content-schema.ts`](./lib/content-schema.ts)). `RESEND_API_KEY` stays in the
environment because it's a provider credential, not a setting.

See [`DEPLOY.md`](./DEPLOY.md) for the production (Vercel + cloud Supabase) runbook.

## Structure (ryzo conventions)

```
app/
  layout.tsx              # root: <html lang dir>, fonts, SessionProvider + NextIntlClientProvider, DirSync, Toaster
  [locale]/               # public storefront (as-needed prefixing)
    layout.tsx            # setRequestLocale, direct-import messages, storefront chrome + cart
    page.tsx  collections/[handle]  products/[handle]  pages/*  account/*  checkout  search  wishlist
  admin/                  # admin — OUTSIDE [locale]
    login/                # public admin login
    (panel)/              # guarded route group: layout guards ADMIN, renders AdminShell
      page.tsx (dashboard+charts)  orders  products/[id]  collections  customers  coupons  content/[section]
  api/
    admin/**              # REST route.ts (products images/import, coupons, content, export CSV) — requireAdmin()
    skipcash/{webhook,return}  auth/[...nextauth]
i18n/{routing,request}.ts · messages/{en,ar}.json · lib/i18n-navigation.ts
lib/  supabase.ts database.types.ts auth.ts admin-auth.ts skipcash.ts email.ts money.ts
      coupons.ts content.ts content-schema.ts data/* actions/*
components/  layout · home · product · collection · cart · checkout · account · admin · providers · DirSync
supabase/migrations/  20260704120000_commerce.sql  20260704120100_rpc.sql
scripts/  seed-supabase.ts  upload-assets.ts  set-admin-password.ts  generate-favicon.ts  meta-test-event.ts
```

## What works (all verified via Playwright)

- **Storefront** — home, collections (sort/filter), product pages, cart drawer, **coupons**, checkout
  (**SkipCash** or demo, via atomic `create_order`/`mark_order_paid` RPCs), **shipping + tax**, order
  confirmation + **email**, accounts, search, wishlist.
- **Admin** (`/admin`) — dashboard (KPIs + revenue chart + top products + **payments/email status**), orders
  (status/tracking, **payment provider + shipping + tax**), products (per-variant stock, flags, **image
  upload** to Storage, **bulk JSON import**), collections, customers (+ **CSV export**), **coupons** CRUD,
  **content editors** incl. **Commerce & Payments** (shipping/tax/email), all bilingual.
- **i18n** — English unprefixed + Arabic `/ar` with full RTL; DirSync; per-route metadata built inline.
- **Security** — admin pages guarded by the `(panel)` server layout; every `/api/admin/**` route calls `requireAdmin()` (401 otherwise).

## Notes
- Transactions are Postgres RPC (`supabase/migrations/*_rpc.sql`) — PostgREST has no multi-statement txns.
- Product imagery stays in `public/assets`; Storage (`product-images` bucket) is used for new admin uploads.
- Arabic product copy falls back to English; UI + editable content are bilingual (`key`/`key_ar` fields).
- Shipping/tax are computed server-side in `create_order` from the admin **Commerce & Payments** settings
  (never trusted from the client); the checkout summary mirrors them for display.
- For production: see [`DEPLOY.md`](./DEPLOY.md) — cloud Supabase, SkipCash keys, Resend, and Vercel.

## Troubleshooting

### `next dev` dies with "Fatal JavaScript out of memory ... during deserialization"

Symptoms: the server prints `○ Compiling /[locale] ...`, then a wall of V8 OOM stack traces, often
alongside a Rust panic reading `The paging file is too small for this operation to complete`.

This is **not** a code-level memory leak. Turbopack runs PostCSS (Tailwind) in Node child
processes, and when the on-disk Turbopack cache under `.next/dev/cache` grows large enough those
workers start failing at startup. A failed worker is respawned, which fails too, and the loop
spawns processes until Windows runs out of commit charge — a machine with plenty of free RAM can
still hit this, because the limit is commit, not physical memory.

The trap is that it compounds: when the dev server dies its children are **orphaned rather than
killed**, so each crashed run leaves dozens of idle `node` processes resident and the next
`npm run dev` starts with less headroom than the last.

Fix:

```bash
npm run clean     # deletes .next, including the Turbopack cache
npm run dev
# or in one step:  npm run dev:clean
```

If a run has already crashed, kill the orphans first, otherwise they keep the memory:

```powershell
# Windows — leaves unrelated node processes (MCP servers, other repos) alone
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*favetaahouse-dev\.next\dev\build*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

A healthy `next dev` for this project holds **2–3** node processes. If `Get-Process node` shows
dozens, that is the runaway — clean and restart rather than waiting it out.
