import "server-only";
import { supabase } from "@/lib/supabase";

export type NotifyInput = {
  audience?: "admins" | "user";
  userId?: string | null;
  type?: string;
  title: string;
  body?: string;
  link?: string;
  level?: "info" | "success" | "warning" | "error";
};

/** Create a notification. Never throws — notifications must not break the caller. */
export async function createNotification(n: NotifyInput): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      audience: n.audience ?? "admins",
      user_id: n.userId ?? null,
      type: n.type ?? "system",
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      level: n.level ?? "info",
    });
  } catch {
    /* swallow */
  }
}

export async function listAdminNotifications(limit = 20) {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("audience", "admins")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function unreadAdminCount(): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("audience", "admins")
    .is("read_at", null);
  return count ?? 0;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const read_at = new Date().toISOString();
  if (ids && ids.length) {
    await supabase.from("notifications").update({ read_at }).in("id", ids);
  } else {
    await supabase.from("notifications").update({ read_at }).eq("audience", "admins").is("read_at", null);
  }
}
