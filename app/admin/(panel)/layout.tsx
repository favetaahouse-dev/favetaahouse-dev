import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAdminSession, sessionUser } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
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
