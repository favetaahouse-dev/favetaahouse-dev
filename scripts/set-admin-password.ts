/**
 * Set (or reset) the store admin login on whatever Supabase `SUPABASE_URL` points to,
 * WITHOUT wiping any data. This is the admin half of scripts/seed-supabase.ts pulled out
 * so you can change the admin email/password on a live store safely.
 *
 * Usage (run from the project root):
 *   npx tsx scripts/set-admin-password.ts                     # uses ADMIN_EMAIL / ADMIN_PASSWORD from .env.local
 *   npx tsx scripts/set-admin-password.ts you@store.com secret # explicit email + password
 */
import process from "node:process";
// Load .env.local first (cloud values), then .env — same precedence as the seed script.
try { process.loadEnvFile(".env.local"); } catch {}
try { process.loadEnvFile(".env"); } catch {}
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env.local");

const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const password = process.argv[3] || process.env.ADMIN_PASSWORD || "";
const name = process.env.ADMIN_NAME || "Store Admin";
if (!email || !password) {
  throw new Error("Provide an email + password (as args, or via ADMIN_EMAIL / ADMIN_PASSWORD)");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log(`Target Supabase : ${new URL(url!).host}`);
  console.log(`Admin email     : ${email}`);

  // Upsert the admin row (create if missing, update password if it exists). role:"ADMIN"
  // alone already grants admin access via the legacy fallback in lib/auth.ts.
  const { error: upErr } = await supabase
    .from("users")
    .upsert({ email, name, role: "ADMIN", password: await bcrypt.hash(password, 10) }, { onConflict: "email" });
  if (upErr) throw new Error(`users upsert: ${upErr.message}`);

  // Promote to super_admin via the modern RBAC path too, matching the seed. Skipped
  // harmlessly if the roles table isn't present.
  const { data: role } = await supabase.from("roles").select("id").eq("key", "super_admin").maybeSingle();
  if (role?.id) {
    const { error: rErr } = await supabase.from("users").update({ role_id: role.id }).eq("email", email);
    if (rErr) throw new Error(`role_id update: ${rErr.message}`);
  }

  console.log(`\n✓ Admin login updated: ${email} / ${"•".repeat(password.length)} (role: super_admin)`);
  console.log("  Log in at /admin on the live site with these credentials.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
