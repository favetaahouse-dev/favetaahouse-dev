"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { isPermission } from "@/lib/rbac/permissions";
import {
  SUPER_ADMIN_KEY,
  assertCanActOnRank,
  assertRoleDeletable,
  getRoleOrThrow,
} from "@/lib/rbac/guards";

const PATH = "/admin/settings/users";

const roleSchema = z.object({
  key: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
  rank: z.number().int().min(1).max(99), // 100 is super_admin's
});

const slugKey = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/**
 * Replace a role's permission grants. Diff-based on purpose: the seed's
 * delete-all-then-reinsert leaves a role with zero permissions if it fails midway.
 */
export async function setRolePermissions(roleId: string, permissions: string[]) {
  const actor = await authorize("roles:manage");
  const role = await getRoleOrThrow(roleId);

  // super_admin bypasses can() in code, so its rows are decorative — editing them
  // would imply a control that doesn't exist.
  if (role.key === SUPER_ADMIN_KEY) throw new Error("super_admin always has every permission");
  assertCanActOnRank(actor, role.rank);

  // role_permissions.permission is bare text with no FK or CHECK, so an unknown string
  // inserts happily and becomes a dead row nothing will ever match.
  const next = [...new Set(permissions)];
  const bad = next.filter((p) => !isPermission(p));
  if (bad.length) throw new Error(`unknown permission(s): ${bad.join(", ")}`);

  const { data: existing } = await supabase.from("role_permissions").select("permission").eq("role_id", roleId);
  const current = new Set((existing ?? []).map((r) => r.permission as string));
  const added = next.filter((p) => !current.has(p));
  const removed = [...current].filter((p) => !next.includes(p));
  if (!added.length && !removed.length) return { ok: true, added: 0, removed: 0 };

  if (added.length) {
    const { error } = await supabase
      .from("role_permissions")
      .insert(added.map((permission) => ({ role_id: roleId, permission })));
    if (error) throw new Error(error.message);
  }
  if (removed.length) {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .in("permission", removed);
    if (error) throw new Error(error.message);
  }

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "role.permissions.update",
    resourceType: "role",
    resourceId: roleId,
    summary: `${role.name}: +${added.length} / -${removed.length} permissions`,
    metadata: { added, removed },
  });
  revalidatePath(PATH);
  return { ok: true, added: added.length, removed: removed.length };
}

export async function createRole(input: z.input<typeof roleSchema>) {
  const actor = await authorize("roles:manage");
  const parsed = roleSchema.parse(input);
  // Nobody mints a role that outranks them.
  assertCanActOnRank(actor, parsed.rank);

  const key = slugKey(parsed.key);
  if (!key) throw new Error("invalid role key");
  const { data: clash } = await supabase.from("roles").select("id").eq("key", key).maybeSingle();
  if (clash) throw new Error("a role with that key already exists");

  const { data, error } = await supabase
    .from("roles")
    .insert({
      key,
      name: parsed.name,
      description: parsed.description ?? null,
      rank: parsed.rank,
      is_system: false, // only the migration's built-ins are system roles
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "role.create",
    resourceType: "role",
    resourceId: data.id as string,
    summary: `Created role ${parsed.name} (rank ${parsed.rank})`,
    metadata: { key, rank: parsed.rank },
  });
  revalidatePath(PATH);
  return { id: data.id as string };
}

export async function updateRole(id: string, input: Partial<z.input<typeof roleSchema>>) {
  const actor = await authorize("roles:manage");
  const role = await getRoleOrThrow(id);
  assertCanActOnRank(actor, role.rank);

  const row: Database["public"]["Tables"]["roles"]["Update"] = {};
  if (input.description !== undefined) row.description = input.description || null;

  if (role.is_system) {
    // `key` is matched on in code (access.ts, ROLE_KEYS) and `rank` is what the guards
    // above compare, so a built-in may only have its description reworded.
    if (input.name !== undefined || input.rank !== undefined || input.key !== undefined) {
      throw new Error("built-in roles: only the description can be edited");
    }
  } else {
    if (input.name !== undefined) row.name = z.string().trim().min(2).max(60).parse(input.name);
    if (input.rank !== undefined) {
      const rank = z.number().int().min(1).max(99).parse(input.rank);
      assertCanActOnRank(actor, rank); // can't lift a role above yourself
      row.rank = rank;
    }
    if (input.key !== undefined) throw new Error("a role's key cannot change once created");
  }

  if (!Object.keys(row).length) return { ok: true };
  const { error } = await supabase.from("roles").update(row).eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "role.update",
    resourceType: "role",
    resourceId: id,
    summary: `Updated role ${role.name}`,
    metadata: { changed: Object.keys(row) },
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteRole(id: string) {
  const actor = await authorize("roles:manage");
  const role = await getRoleOrThrow(id);
  assertCanActOnRank(actor, role.rank);
  // Refuses while occupied: role_id is ON DELETE SET NULL and a null role_id on an
  // 'ADMIN' row resolves to super_admin, so deleting would promote its holders.
  await assertRoleDeletable(role);

  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "role.delete",
    resourceType: "role",
    resourceId: id,
    summary: `Deleted role ${role.name}`,
    metadata: { key: role.key },
  });
  revalidatePath(PATH);
  return { ok: true };
}
