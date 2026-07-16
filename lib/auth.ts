import NextAuth from "next-auth";
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
          .select("id, email, name, password, role, role_id")
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
    jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role?: string; roleRank?: number; permissions?: string[] };
        token.id = u.id;
        token.role = u.role ?? CUSTOMER_ROLE;
        token.roleRank = u.roleRank ?? 0;
        token.permissions = u.permissions ?? [];
      }
      return token;
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
