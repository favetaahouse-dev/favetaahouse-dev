/**
 * Pure RBAC checks — safe to import from both server and client (no server-only,
 * no DB). Server code (lib/admin-auth.ts) and the client hook (lib/rbac/use-permissions.ts)
 * both build on these.
 */
import { CUSTOMER_ROLE, type Permission } from "./permissions";

export type Access = { role: string; roleRank: number; permissions: string[] };

/** A user with any non-customer role has admin-panel (staff) access. */
export function isStaff(a: Access | null | undefined): boolean {
  return !!a && !!a.role && a.role !== CUSTOMER_ROLE;
}

/**
 * super_admin bypasses every check; otherwise the permission must be granted.
 * "ADMIN" is the legacy pre-RBAC role — treat it as a full super admin so existing
 * sessions (and any user still on the old role) keep full access.
 */
export function can(a: Access | null | undefined, perm: Permission): boolean {
  if (!a) return false;
  if (a.role === "super_admin" || a.role === "ADMIN") return true;
  return a.permissions.includes(perm);
}
