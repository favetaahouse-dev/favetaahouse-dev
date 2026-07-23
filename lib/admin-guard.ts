import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, sessionUser, type SessionUser } from "@/lib/admin-auth";
import { isStaff } from "@/lib/rbac/access";
import type { Permission } from "@/lib/rbac/permissions";

/**
 * Page guard. Kept out of `admin-auth.ts` because this imports `next/navigation`,
 * which route handlers must not pull in.
 *
 * Every page under app/admin/(panel) calls this: the layout can only prove there is
 * a session, not that the viewer may see *this* page, and `SidebarNav` merely hides
 * links. Returns the actor so pages can reuse `id` / `roleRank`.
 */
export async function requirePageAccess(perm?: Permission): Promise<SessionUser> {
  const u = sessionUser(await auth());
  if (!isStaff(u)) redirect("/admin/login");
  if (perm && !hasPermission(u, perm)) redirect("/admin/forbidden");
  return u!;
}
