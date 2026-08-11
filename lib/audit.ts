import "server-only";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string; // e.g. "product.update", "order.refund"
  resourceType?: string;
  resourceId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

/** Write an admin activity entry. Never throws — audit must not break a mutation. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      ua = h.get("user-agent") || null;
    } catch {
      /* headers() unavailable outside a request scope */
    }
    await supabase.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      summary: entry.summary ?? null,
      metadata: (entry.metadata ?? {}) as never,
      ip,
      user_agent: ua,
    });
  } catch {
    /* swallow */
  }
}
