/**
 * Granular RBAC permission catalog — the single source of truth for what actions
 * exist and which built-in role gets them. Permissions are `resource:action`
 * strings. `super_admin` bypasses every check in code (see lib/admin-auth.ts), so
 * it need not be enumerated here. `role_permissions` rows are seeded from
 * DEFAULT_ROLE_PERMISSIONS by scripts/seed-supabase.ts and editable in the admin.
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
  "reviews:read",
  "reviews:moderate",
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
const READS: Permission[] = PERMISSIONS.filter((p) => p.endsWith(":read"));

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
    "reviews:read", "reviews:moderate",
    "notifications:read", "notifications:write",
    "audit:read",
  ],
  staff: [
    "dashboard:read",
    "products:read",
    "inventory:read", "inventory:write",
    "orders:read", "orders:write",
    "customers:read",
    "notifications:read",
  ],
  read_only: [...READS],
};

export function isPermission(x: string): x is Permission {
  return (PERMISSIONS as readonly string[]).includes(x);
}
