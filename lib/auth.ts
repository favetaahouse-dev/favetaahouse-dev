import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { CUSTOMER_ROLE } from "@/lib/rbac/permissions";

/** Resolve a user's role key, rank, and granted permissions from role_id. */
async function resolveAccess(user: {
  role_id: string | null;
  role: string | null;
}): Promise<{ role: string; roleRank: number; permissions: string[] }> {
  if (user.role_id) {
    const { data: role } = await supabase
      .from("roles")
      .select("key, rank")
      .eq("id", user.role_id)
      .maybeSingle();
    if (role) {
      const { data: rp } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role_id", user.role_id);
      return { role: role.key, roleRank: role.rank, permissions: (rp ?? []).map((r) => r.permission) };
    }
  }
  // Legacy fallback: a user with the old ADMIN role but no role_id is a super admin.
  if (user.role === "ADMIN") return { role: "super_admin", roleRank: 100, permissions: [] };
  return { role: CUSTOMER_ROLE, roleRank: 0, permissions: [] };
}

/** How long a JWT may hold stale grants before they're re-read from the DB. */
const ACCESS_TTL_MS = 60_000;

/**
 * Re-read a live session's role and permissions. Fails CLOSED: if the user row is
 * gone or the query throws, the session drops to zero permissions rather than
 * keeping whatever it was last granted — a deleted staff member's cookie must stop
 * working. Costs one indexed lookup per user per TTL.
 */
async function refreshAccess(token: JWT): Promise<JWT> {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("role, role_id")
      .eq("id", token.id as string)
      .maybeSingle();
    if (error) throw error;
    if (!user) {
      return { ...token, role: CUSTOMER_ROLE, roleRank: 0, permissions: [], accessAt: Date.now() };
    }
    const access = await resolveAccess({ role_id: user.role_id, role: user.role });
    return { ...token, ...access, accessAt: Date.now() };
  } catch {
    // Don't stamp accessAt on failure — retry on the next request instead of
    // locking the session out for a full TTL over one transient DB error.
    return { ...token, role: CUSTOMER_ROLE, roleRank: 0, permissions: [] };
  }
}

function clientMeta(req: Request | undefined) {
  const h = req?.headers;
  const ip = h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip") || null;
  const ua = h?.get("user-agent") || null;
  return { ip, ua };
}

async function logLogin(
  entry: { user_id: string | null; email: string; success: boolean },
  req: Request | undefined,
) {
  const { ip, ua } = clientMeta(req);
  try {
    await supabase.from("login_events").insert({ ...entry, ip, user_agent: ua });
  } catch {
    /* never block auth on audit write */
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds, req) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const { data: user } = await supabase
          .from("users")
          .select("id, email, name, password, role, role_id, email_verified")
          .eq("email", email)
          .maybeSingle();
        if (!user?.password) {
          await logLogin({ user_id: null, email, success: false }, req);
          return null;
        }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          await logLogin({ user_id: user.id, email, success: false }, req);
          return null;
        }
        // Customers must verify their email before their first login. Staff/admin are
        // panel-created and auto-verified, so this gate never applies to them.
        if (user.role === CUSTOMER_ROLE && !user.email_verified) {
          await logLogin({ user_id: user.id, email, success: false }, req);
          return null;
        }
        const access = await resolveAccess({ role_id: user.role_id, role: user.role });
        await logLogin({ user_id: user.id, email, success: true }, req);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: access.role,
          roleRank: access.roleRank,
          permissions: access.permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role?: string; roleRank?: number; permissions?: string[] };
        token.id = u.id;
        token.role = u.role ?? CUSTOMER_ROLE;
        token.roleRank = u.roleRank ?? 0;
        token.permissions = u.permissions ?? [];
        token.accessAt = Date.now();
        return token;
      }

      // Access used to be resolved only at sign-in, which froze a session's permissions
      // for its whole life: editing a role changed nothing until the user signed out, and
      // a revoked admin kept their grants. Re-resolve on a TTL instead.
      if (!token.id || Date.now() - ((token.accessAt as number) ?? 0) < ACCESS_TTL_MS) return token;
      return refreshAccess(token);
    },
    session({ session, token }) {
      if (session.user) {
        const su = session.user as {
          id?: string;
          role?: string;
          roleRank?: number;
          permissions?: string[];
        };
        su.id = token.id as string;
        su.role = token.role as string;
        su.roleRank = (token.roleRank as number) ?? 0;
        su.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
});
