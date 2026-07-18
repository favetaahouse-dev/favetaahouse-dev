import { ShieldCheck, Users as UsersIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requirePageAccess } from "@/lib/admin-guard";
import { SUPER_ADMIN_KEY } from "@/lib/rbac/guards";
import { StaffTable, type StaffRow } from "@/components/admin/settings/StaffTable";
import { RolePermissionMatrix, type MatrixRole } from "@/components/admin/settings/RolePermissionMatrix";

type RoleRef = { name: string; key: string; rank: number } | { name: string; key: string; rank: number }[] | null;
type StaffQuery = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  role_id: string | null;
  created_at: string;
  role_info: RoleRef;
};
type RoleQuery = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  is_system: boolean;
  permissions: { permission: string }[] | null;
};

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const one = (ref: RoleRef) => (Array.isArray(ref) ? ref[0] : ref) ?? null;

export default async function StaffRolesPage() {
  const actor = await requirePageAccess("users:read");

  const [{ data: staffData }, { data: rolesData }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, name, role, role_id, created_at, role_info:roles(name, key, rank)")
      .neq("role", "CUSTOMER")
      .order("created_at", { ascending: true }),
    supabase
      .from("roles")
      .select("id, key, name, description, rank, is_system, permissions:role_permissions(permission)")
      .order("rank", { ascending: false }),
  ]);

  const staff: StaffRow[] = ((staffData ?? []) as StaffQuery[]).map((u) => {
    const r = one(u.role_info);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      roleId: u.role_id,
      roleName: r?.name ?? pretty(u.role),
      // No role_id resolves to super_admin in lib/auth.ts, so treat it as rank 100
      // here too — the table must not offer to edit someone it can't actually touch.
      roleRank: r?.rank ?? (u.role === "ADMIN" ? 100 : 0),
      createdAt: u.created_at,
    };
  });

  const roleRows = (rolesData ?? []) as RoleQuery[];
  const roles: MatrixRole[] = roleRows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    rank: r.rank,
    isSystem: r.is_system,
    permissions: (r.permissions ?? []).map((p) => p.permission),
  }));

  const actorIsSuper = actor.role === SUPER_ADMIN_KEY;

  return (
    <div className="space-y-6">
      <PageHeader title="Staff & Roles" description="Team members with admin access and the roles that grant it" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Staff members" value={staff.length} icon={<UsersIcon size={15} />} />
        <StatCard label="Roles" value={roles.length} icon={<ShieldCheck size={15} />} />
        <StatCard label="Permissions" value={PERMISSIONS.length} icon={<ShieldCheck size={15} />} />
      </div>

      <StaffTable
        staff={staff}
        roles={roles.map((r) => ({ id: r.id, name: r.name, rank: r.rank }))}
        actorId={actor.id}
        actorRank={actor.roleRank}
        actorIsSuper={actorIsSuper}
      />

      <RolePermissionMatrix roles={roles} actorRank={actor.roleRank} actorIsSuper={actorIsSuper} />
    </div>
  );
}
