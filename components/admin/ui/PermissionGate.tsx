"use client";

import type { ReactNode } from "react";
import type { Permission } from "@/lib/rbac/permissions";
import { usePermissions } from "@/lib/rbac/use-permissions";

/** Render children only when the current user holds `permission` (super_admin bypasses). */
export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(permission) ? children : fallback}</>;
}
