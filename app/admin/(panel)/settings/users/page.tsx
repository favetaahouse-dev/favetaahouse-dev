import { ShieldCheck, Users as UsersIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader, Panel, StatCard, Badge, EmptyState } from "@/components/admin/ui";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

type RoleRef = { name: string; key: string; rank: number } | { name: string; key: string; rank: number }[] | null;
type StaffRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  role_info: RoleRef;
};
type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  is_system: boolean;
  permissions: { permission: string }[] | null;
};

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function roleName(role: string, ref: RoleRef): string {
  const r = Array.isArray(ref) ? ref[0] : ref;
  return r?.name ?? pretty(role);
}

export default async function StaffRolesPage() {
  const [{ data: staffData }, { data: rolesData }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, name, role, created_at, role_info:roles(name, key, rank)")
      .neq("role", "CUSTOMER")
      .order("created_at", { ascending: true }),
    supabase
      .from("roles")
      .select("id, key, name, description, rank, is_system, permissions:role_permissions(permission)")
      .order("rank", { ascending: false }),
  ]);

  const staff = (staffData ?? []) as StaffRow[];
  const roles = (rolesData ?? []) as RoleRow[];
  const totalPerms = PERMISSIONS.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Staff & Roles" description="Team members with admin access and the roles that grant it" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Staff members" value={staff.length} icon={<UsersIcon size={15} />} />
        <StatCard label="Roles" value={roles.length} icon={<ShieldCheck size={15} />} />
        <StatCard label="Permissions" value={totalPerms} icon={<ShieldCheck size={15} />} />
      </div>

      <Panel>
        <div className="border-b border-edge px-4 py-3">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-faint">Staff members ({staff.length})</h2>
        </div>
        {staff.length === 0 ? (
          <EmptyState title="No staff accounts" description="Users with any non-customer role appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-4 py-3 text-start">Name</th>
                  <th className="px-3 py-3 text-start">Email</th>
                  <th className="px-3 py-3 text-start">Role</th>
                  <th className="px-3 py-3 text-start">Joined</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id} className="border-b border-edge/60 text-foreground">
                    <td className="px-4 py-2.5">{u.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-secondary">{u.email}</td>
                    <td className="px-3 py-2.5"><Badge tone="accent">{roleName(u.role, u.role_info)}</Badge></td>
                    <td className="px-3 py-2.5 text-faint">{new Date(u.created_at).toLocaleDateString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="border-b border-edge px-4 py-3">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-faint">Roles ({roles.length})</h2>
        </div>
        {roles.length === 0 ? (
          <EmptyState title="No roles defined" description="Seed the roles table to manage granular permissions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-4 py-3 text-start">Role</th>
                  <th className="px-3 py-3 text-start">Description</th>
                  <th className="px-3 py-3 text-end">Permissions</th>
                  <th className="px-3 py-3 text-start">Type</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const count = r.permissions?.length ?? 0;
                  const isSuper = r.key === "super_admin";
                  return (
                    <tr key={r.id} className="border-b border-edge/60 text-foreground">
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5 text-secondary">{r.description ?? "—"}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {isSuper ? "All" : `${count} / ${totalPerms}`}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={r.is_system ? "info" : "neutral"}>{r.is_system ? "System" : "Custom"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
