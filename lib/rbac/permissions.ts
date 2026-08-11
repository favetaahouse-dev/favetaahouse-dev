/**
 * Granular RBAC permission catalog — the single source of truth for what actions
 * exist and which built-in role gets them. Permissions are `resource:action`
 * strings. `super_admin` bypasses every check in code (see lib/admin-auth.ts), so
 * it need not be enumerated here.
 *
 * DEFAULT_ROLE_PERMISSIONS is the SEED TEMPLATE, not live state: live grants are
 * `role_permissions` rows, written once by scripts/seed-supabase.ts and thereafter
 * edited in Admin → Settings → Staff & roles. Editing this file changes nothing in
 * a running install, and re-running the seed DELETES every grant for every role and
 * reinserts from here — destroying any edits made in the admin.
 */

export const PERMISSIONS = [
  "dashboard:read",
  "analytics:read",
  "products:read",
  "products:write",
  "products:delete",
  "inventory:read",
  "inventory:write",
  "categories:read",
  "categories:write",
  "orders:read",
  "orders:write",
  "orders:refund",
  "customers:read",
  "customers:write",
  "coupons:read",
  "coupons:write",
  "content:read",
  "content:write",
  "notifications:read",
  "notifications:write",
  "users:read",
  "users:manage",
  "roles:manage",
  "settings:manage",
  "audit:read",
  "backup:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = ["super_admin", "admin", "manager", "staff", "read_only"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** The customer role key stored in the legacy `users.role` column. */
export const CUSTOMER_ROLE = "CUSTOMER";

const ALL: Permission[] = [...PERMISSIONS];

/** Built-in role → default permission grants (super_admin bypasses; not listed). */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<RoleKey, "super_admin">, Permission[]> = {
  admin: ALL.filter((p) => p !== "roles:manage"),
  manager: [
    "dashboard:read", "analytics:read",
    "products:read", "products:write", "products:delete",
    "inventory:read", "inventory:write",
    "categories:read", "categories:write",
    "orders:read", "orders:write", "orders:refund",
    "customers:read", "customers:write",
    "coupons:read", "coupons:write",
    "content:read", "content:write",
    "notifications:read", "notifications:write",
    "audit:read",
  ],
  staff: [
    "dashboard:read",
    "products:read",
    "inventory:read", "inventory:write",
    "orders:read", "orders:write",
    // notifications:write, not just :read — marking the bell read is a write, and
    // markNotificationsRead() with no ids clears the whole team's inbox.
    "notifications:read", "notifications:write",
  ],
  // Enumerated deliberately rather than PERMISSIONS.filter(p => p.endsWith(":read")):
  // that trick silently handed read_only `customers:read` (the full customer PII CSV
  // export) and `audit:read` (the security log). "Read only" means operational data.
  read_only: [
    "dashboard:read",
    "analytics:read",
    "products:read",
    "inventory:read",
    "categories:read",
    "orders:read",
    "coupons:read",
    "content:read",
    "notifications:read",
    "users:read",
  ],
};

export function isPermission(x: string): x is Permission {
  return (PERMISSIONS as readonly string[]).includes(x);
}
