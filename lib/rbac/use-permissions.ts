"use client";

import { useSession } from "next-auth/react";
import { can as canCheck, isStaff, type Access } from "./access";
import type { Permission } from "./permissions";

/** Client-side access to the current user's role + permission checks. */
export function usePermissions() {
  const { data, status } = useSession();
  const u = data?.user as Partial<Access> | undefined;
  const access: Access = {
    role: u?.role ?? "",
    roleRank: u?.roleRank ?? 0,
    permissions: u?.permissions ?? [],
  };
  return {
    access,
    role: access.role,
    roleRank: access.roleRank,
    loading: status === "loading",
    isStaff: isStaff(access),
    can: (p: Permission) => canCheck(access, p),
  };
}
