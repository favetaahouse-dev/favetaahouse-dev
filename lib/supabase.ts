import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let client: SupabaseClient<Database> | null = null;

/** Server-only Supabase client using the service-role key (bypasses RLS). */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY");
    client = createClient<Database>(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_t, prop) {
    const c = getSupabase();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
