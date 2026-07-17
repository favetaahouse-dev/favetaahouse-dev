# Deploying ALESSIA ABAYA (Vercel + cloud Supabase + SkipCash)

This app runs feature-complete **locally in demo mode** with no external accounts. To go live you connect
four things: a cloud **Supabase** database, the **SkipCash** payment gateway, **Resend** for order emails,
and a **Vercel** deployment. Do them in this order.

Local prerequisites: `npm install`, the Supabase CLI, and a Supabase account.

---

## 1. Cloud Supabase (database)

1. Create a project at [supabase.com](https://supabase.com). Note the project ref, the **anon** and
   **service_role** keys (Settings → API), and set a DB password.
2. Link and push the schema (applies `supabase/migrations/*` — the commerce schema + RPCs, including the
   `payments` table and shipping/tax logic):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```
3. Upload product media into this project's Storage. The repo ships no product imagery, so this must
   run before the seed — the seed writes Storage URLs and does not check that the objects exist.
   ```bash
   SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
   SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY" \
   npm run upload-assets
   ```
   Creates the public `product-images` and `media` buckets if absent and uploads ~79MB (well inside the
   1GB free tier). Idempotent — re-run it freely. Needs a checkout that still has `public/assets/files`
   and `public/assets/video`; if yours doesn't, restore them from the media backup first.
4. Seed the catalog + logins into the cloud DB. Point the seed at the cloud project, then run it:
   ```bash
   # temporarily set the cloud creds in your shell (or a .env.local the seed reads)
   SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
   SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY" \
   ADMIN_EMAIL="admin@your-domain.com" \
   ADMIN_PASSWORD="A_STRONG_UNIQUE_PASSWORD" \
   DEMO_EMAIL="demo@your-domain.com" \
   DEMO_PASSWORD="ANOTHER_STRONG_PASSWORD" \
   npm run seed
   ```
   (99 products / 448 variants / 19 collections / admin + demo users.) The seed **fails** rather than
   fall back to a default if `ADMIN_PASSWORD` / `DEMO_PASSWORD` are unset — the admin it creates is a
   full super-admin on an internet-facing `/admin`, so give it a strong, unique password here.

   Note your local `.env` is read as a fallback for anything you don't set in the shell, so run this
   from outside the project directory (or unset those vars) if you don't want your dev passwords
   seeded into production. `SUPABASE_URL` is also what `lib/asset-url.ts` builds the product image
   URLs from, and the seed bakes them into the DB — set it to the cloud project here, or every image
   row gets a `127.0.0.1` URL.
5. Regenerate types if you changed the schema afterward: `npm run db:types`.

> RLS is deny-all on every table; the app only ever talks to the DB through the server-side service-role
> client. The browser never gets DB grants.

---

## 2. SkipCash (payments)

1. Get a **merchant account** at [skipcash.app](https://skipcash.app). You'll have **TEST** and
   **PRODUCTION** credential sets — start with TEST.
2. From the portal, collect: **Client ID**, **Key ID**, **Key Secret**, **Webhook Key**.
3. In the portal, configure the callback URLs (once your Vercel domain exists — step 4):
   - **Webhook / notification URL:** `https://your-domain.com/api/skipcash/webhook`
   - **Return URL:** `https://your-domain.com/api/skipcash/return`
4. Set env: `SKIPCASH_ENV=sandbox` with the TEST keys to verify end-to-end, then switch to
   `SKIPCASH_ENV=production` with the PRODUCTION keys to go live.

**How it works:** checkout creates the order + a `payments` row, then redirects the shopper to SkipCash's
hosted page. On payment, SkipCash calls our **webhook** (server-to-server, the source of truth) and returns
the shopper to our **return** route. Both verify the payment via SkipCash's GET API and only mark the order
paid when `statusId === 2` — idempotently, so double-delivery never double-charges stock or double-emails.

> When SkipCash keys are absent, checkout falls back to **demo mode** (orders marked paid instantly). Never
> ship to production without real keys.

---

## 3. Resend (order emails)

1. Create an account at [resend.com](https://resend.com), verify your sending domain, create an API key.
2. Set `RESEND_API_KEY` — the only email value that is an env var, because it's a provider credential.
3. Everything else is in **Admin → Content → Commerce & Payments**: toggle emails on/off, sender name,
   **from-address** and reply-to. The from-address **must be on the domain you verified in step 1** —
   Resend rejects anything else and the send fails silently, so change it there deliberately.
   Without `RESEND_API_KEY`, sends are skipped (and logged), so the rest of checkout is unaffected.

---

## 4. Vercel (hosting)

Vercel auto-detects Next.js — no `vercel.json`/`vercel.ts` needed. Security headers ship from
`next.config.ts`.

1. Import the repo into Vercel (or `vercel link`).
2. Add every variable from [`.env.production.example`](./.env.production.example) under Settings →
   Environment Variables (Production). Generate a fresh `AUTH_SECRET` (`openssl rand -hex 32`). Set
   `NEXT_PUBLIC_SITE_URL` / `NEXTAUTH_URL` to your real domain.
3. Deploy. Then go back to the SkipCash portal (step 2.3) and set the webhook + return URLs to the live domain.

### Rate limiting / abuse protection

Use the **Vercel Firewall (WAF)** for platform-level rate limiting — no code or extra infra:

- Add rate-limit rules for `/api/skipcash/*` and the checkout path (e.g. N requests/min per IP).
- Vercel BotID / Attack Mode are available if needed.

(Optional app-level upgrade: Upstash Redis from the Vercel Marketplace for per-key limits.)

---

## Post-deploy smoke test

1. Storefront loads; a product adds to cart; checkout summary shows **Shipping + Tax** matching your
   Admin → Commerce & Payments settings.
2. With `SKIPCASH_ENV=sandbox`, complete a **test** payment → redirected back → order shows **PAID**;
   the confirmation email arrives; the order's Payment block (admin) shows provider `SKIPCASH` + reference.
3. Response headers include `Strict-Transport-Security`, `X-Content-Type-Options`, etc.
4. Flip `SKIPCASH_ENV=production` + production keys and run one real low-value order.
