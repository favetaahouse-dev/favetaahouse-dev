import "server-only";
import { supabase } from "@/lib/supabase";

type HeaderGetter = { get(name: string): string | null };

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function ipFrom(h: HeaderGetter): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") || "unknown";
}

/**
 * Per-key fixed-window rate limit, backed by the rate_limits table + rate_limit_hit RPC.
 * Returns true when the request is ALLOWED. Fails OPEN: any error (DB blip, missing RPC)
 * returns true, so a limiter problem can never block a legitimate checkout or payment callback.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc error — allowing", error);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit] threw — allowing", e);
    return true;
  }
}
