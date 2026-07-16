import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { listAdminNotifications, unreadAdminCount, markNotificationsRead } from "@/lib/notify";

export const runtime = "nodejs";

export async function GET() {
  const bad = await requirePermission("notifications:read");
  if (bad) return bad;
  const [items, unread] = await Promise.all([listAdminNotifications(), unreadAdminCount()]);
  return NextResponse.json({ items, unread });
}

export async function PATCH(req: Request) {
  // A write, and with no ids markNotificationsRead() clears the whole team's inbox —
  // so it must not sit behind a :read grant.
  const bad = await requirePermission("notifications:write");
  if (bad) return bad;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined;
  await markNotificationsRead(ids);
  return NextResponse.json({ ok: true });
}
