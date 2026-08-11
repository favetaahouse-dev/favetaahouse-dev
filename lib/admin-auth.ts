import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { isStaff, can, type Access } from "@/lib/rbac/access";
import type { Permission } from "@/lib/rbac/permissions";

export type SessionUser = Access & { id: string; email: string; name?: string | null };

/** Normalize the NextAuth session.user into a typed access object (or null). */
export function sessionUser(session: Session | null): SessionUser | null {
  const u = session?.user as Partial<SessionUser> | undefined;
  if (!u?.id || !u.role) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name,
    role: u.role,
    roleRank: u.roleRank ?? 0,
    permissions: u.permissions ?? [],
  };
}

/** super_admin bypasses; otherwise the permission must be granted. */
export function hasPermission(u: SessionUser | null, perm: Permission): boolean {
  return can(u, perm);
}

/** Returns the session iff the current user has staff (admin-panel) access, else null. */
export async function getAdminSession(): Promise<Session | null> {
  const session = await auth();
  return isStaff(sessionUser(session)) ? session : null;
}

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
const forbidden = () =>
  new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });

/** Route guard (any staff). Returns a 401 Response when not staff, else null. */
export async function requireAdmin(): Promise<Response | null> {
  return isStaff(sessionUser(await auth())) ? null : unauthorized();
}

/** Route guard (specific permission). 401 if not staff, 403 if lacking it, else null. */
export async function requirePermission(perm: Permission): Promise<Response | null> {
  const u = sessionUser(await auth());
  if (!isStaff(u)) return unauthorized();
  return hasPermission(u, perm) ? null : forbidden();
}

/**
 * Server-action guard: returns the actor, or throws ("unauthorized"/"forbidden").
 * Use at the top of every "use server" admin mutation.
 */
export async function authorize(perm?: Permission): Promise<SessionUser> {
  const u = sessionUser(await auth());
  if (!isStaff(u)) throw new Error("unauthorized");
  if (perm && !hasPermission(u, perm)) throw new Error("forbidden");
  return u!;
}
