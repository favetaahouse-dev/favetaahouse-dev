import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAdminSession, sessionUser } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * The admin panel is per-user by definition — session, permissions and theme all come from
 * cookies, and every page shows live data. None of it should ever be prerendered, so one
 * boundary here defers the whole subtree to request time rather than making 23 pages each
 * opt out for themselves.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}

async function PanelShell({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const u = sessionUser(session)!;
  const theme = (await cookies()).get("admin-theme")?.value === "light" ? "light" : "dark";
  return (
    <AdminShell
      userEmail={u.email}
      access={{ role: u.role, roleRank: u.roleRank, permissions: u.permissions }}
      initialTheme={theme}
    >
      {children}
    </AdminShell>
  );
}
