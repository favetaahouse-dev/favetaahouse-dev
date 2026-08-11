import "server-only";
import { supabase } from "@/lib/supabase";
import type { SessionUser } from "@/lib/admin-auth";
import { CUSTOMER_ROLE } from "@/lib/rbac/permissions";

/**
 * Shared rails for user/role mutations, so no two actions enforce the same rule
 * differently. Every one of these throws — callers should let it surface.
 */

export const SUPER_ADMIN_KEY = "super_admin";

/**
 * Single source of truth for the `users.role` / `users.role_id` pair. The legacy
 * `role` CHECK only allows CUSTOMER/ADMIN, so any staff row must carry 'ADMIN' while
 * `role_id` names the real role. Always write both in one update — supabase-js has no
 * transactions, so a split write can leave the invariant broken.
 */
export function staffRoleColumns(roleKey: string, roleId: string): { role: string; role_id: string } {
  return { role: roleKey === CUSTOMER_ROLE ? CUSTOMER_ROLE : "ADMIN", role_id: roleId };
}

/**
 * Demote to a plain customer. Preferred over deleting a staff row: `orders.user_id`
 * is ON DELETE SET NULL while `addresses`/`carts` cascade, so a hard delete orphans
 * order history and destroys data.
 */
export function revokeAccessColumns(): { role: string; role_id: null } {
  return { role: CUSTOMER_ROLE, role_id: null };
}

/**
 * An actor may only touch strictly lower ranks. Strict `>` on purpose: were it `>=`,
 * an `admin` (80) could edit another `admin` or hand out the `admin` role, and rank
 * would be decorative. super_admin bypasses, as it does everywhere else.
 */
export function assertCanActOnRank(actor: SessionUser, targetRank: number): void {
  if (actor.role === SUPER_ADMIN_KEY) return;
  if (actor.roleRank > targetRank) return;
  throw new Error("forbidden");
}

export async function getRoleOrThrow(roleId: string) {
  const { data: role } = await supabase
    .from("roles")
    .select("id, key, name, rank, is_system")
    .eq("id", roleId)
    .maybeSingle();
  if (!role) throw new Error("role not found");
  return role;
}

/** Block a mutation that would leave the install with no super admin. */
export async function assertNotLastSuperAdmin(userId: string): Promise<void> {
  const { data: role } = await supabase.from("roles").select("id").eq("key", SUPER_ADMIN_KEY).maybeSingle();
  if (!role) return;
  const { data: holder } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("role_id", role.id)
    .maybeSingle();
  if (!holder) return; // target isn't a super admin — nothing to protect

  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role_id", role.id);
  if ((count ?? 0) <= 1) throw new Error("cannot remove the last super admin");
}

/**
 * `users.role_id` is ON DELETE SET NULL, and lib/auth.ts treats role='ADMIN' with a
 * null role_id as super_admin — so deleting an occupied role would silently PROMOTE
 * its holders. Refusing to delete while occupied is what closes that path.
 */
export async function assertRoleDeletable(role: { id: string; key: string; is_system: boolean }): Promise<void> {
  if (role.is_system) throw new Error("built-in roles cannot be deleted");
  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role_id", role.id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} user(s) still hold this role — reassign them first`);
  }
}
