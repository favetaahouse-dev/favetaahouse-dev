import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { hasPermission, sessionUser } from "@/lib/admin-auth";
import { isStaff } from "@/lib/rbac/access";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

// PostgREST needs a filter on every delete; matching "id != nil-uuid" targets all rows.
const NIL = "00000000-0000-0000-0000-000000000000";

/**
 * Destructive "reset stats" for the admin dashboard. Wipes all transactional data —
 * orders, payments, customers and carts — so Revenue / Orders / AOV / Customers read
 * zero for go-live. The product catalog and staff accounts are deliberately kept.
 *
 * Two gates, both required:
 *   1. `backup:manage` permission (admin / super_admin only).
 *   2. A re-check of the caller's OWN login password — the confirmation the button collects.
 */
export async function POST(req: NextRequest) {
  const actor = sessionUser(await auth());
  if (!isStaff(actor)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(actor, "backup:manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

  // Re-verify the caller's own login password against their stored bcrypt hash.
  const { data: row } = await supabase.from("users").select("password").eq("id", actor!.id).maybeSingle();
  if (!row?.password || !(await bcrypt.compare(password, row.password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  // Count first, for the response + audit trail, then delete.
  const [{ count: orders }, { count: customers }] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "CUSTOMER").is("role_id", null),
  ]);

  // Every FK below is ON DELETE CASCADE / SET NULL, so this can't fail on constraints:
  //   orders    → cascades order_items + payments
  //   carts     → cascades cart_items (also clears guest / abandoned carts)
  //   customers → cascades addresses + wishlist_items + notifications; nulls order/login/audit refs
  //
  // The customer filter (role='CUSTOMER' AND role_id IS NULL) can never match a staff row:
  // staff always carry role='ADMIN' with a role_id set (see lib/rbac/guards.ts staffRoleColumns),
  // so no admin account — including the caller's — is ever deleted.
  const delOrders = await supabase.from("orders").delete().neq("id", NIL);
  if (delOrders.error) return NextResponse.json({ error: delOrders.error.message }, { status: 500 });

  const delCarts = await supabase.from("carts").delete().neq("id", NIL);
  if (delCarts.error) return NextResponse.json({ error: delCarts.error.message }, { status: 500 });

  const delCustomers = await supabase.from("users").delete().eq("role", "CUSTOMER").is("role_id", null);
  if (delCustomers.error) return NextResponse.json({ error: delCustomers.error.message }, { status: 500 });

  await logAudit({
    actorId: actor!.id,
    actorEmail: actor!.email,
    action: "stats.reset",
    summary: `Reset dashboard stats — deleted ${orders ?? 0} order(s) and ${customers ?? 0} customer(s) (full clean slate)`,
    metadata: { scope: "full", orders: orders ?? 0, customers: customers ?? 0 },
  });

  return NextResponse.json({ ok: true, orders: orders ?? 0, customers: customers ?? 0 });
}
