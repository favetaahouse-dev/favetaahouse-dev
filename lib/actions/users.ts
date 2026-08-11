"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import {
  assertCanActOnRank,
  assertNotLastSuperAdmin,
  getRoleOrThrow,
  revokeAccessColumns,
  staffRoleColumns,
} from "@/lib/rbac/guards";

const PATH = "/admin/settings/users";

const emailSchema = z.string().email().max(200).transform((s) => s.toLowerCase().trim());
const nameSchema = z.string().trim().min(1).max(120);
// 12 chars: this account is staff on an internet-facing /admin.
const passwordSchema = z.string().min(12, "Use at least 12 characters").max(200);

const createSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  roleId: z.string().uuid(),
});

const updateSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  roleId: z.string().uuid().optional(),
  password: passwordSchema.optional(),
});

/** Postgres unique_violation — the only insert error worth a friendly message. */
const isDuplicate = (msg: string) => /duplicate key|23505/i.test(msg);

async function loadStaff(id: string) {
  const { data } = await supabase
    .from("users")
    .select("id, email, name, role, role_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("user not found");
  return data;
}

/** Rank of the role a user currently holds (0 when they hold none). */
async function currentRank(roleId: string | null): Promise<number> {
  if (!roleId) return 0;
  const { data } = await supabase.from("roles").select("rank").eq("id", roleId).maybeSingle();
  return data?.rank ?? 0;
}

export async function createStaffUser(input: z.input<typeof createSchema>) {
  const actor = await authorize("users:manage");
  const { email, name, password, roleId } = createSchema.parse(input);

  // Rank-check on create, not just on edit — otherwise granting a role you outrank
  // is blocked while minting a brand-new account with it is not.
  const role = await getRoleOrThrow(roleId);
  assertCanActOnRank(actor, role.rank);

  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      name,
      password: await bcrypt.hash(password, 10),
      ...staffRoleColumns(role.key, role.id),
    })
    .select("id")
    .single();
  if (error) throw new Error(isDuplicate(error.message) ? "That email is already in use" : error.message);

  // Never put the password in metadata — logAudit writes it to audit_logs as plaintext jsonb.
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.create",
    resourceType: "user",
    resourceId: data.id as string,
    summary: `Created staff ${email} as ${role.name}`,
    metadata: { email, roleKey: role.key },
  });
  revalidatePath(PATH);
  return { id: data.id as string };
}

export async function updateStaffUser(id: string, input: z.input<typeof updateSchema>) {
  const actor = await authorize("users:manage");
  const patch = updateSchema.parse(input);
  const target = await loadStaff(id);

  // Guard both ends: the rank they hold now, and the rank they'd move to. Without the
  // first, an admin could demote a super_admin and take the panel.
  assertCanActOnRank(actor, await currentRank(target.role_id));

  const changed: string[] = [];
  const row: Database["public"]["Tables"]["users"]["Update"] = {};
  if (patch.name && patch.name !== target.name) { row.name = patch.name; changed.push("name"); }
  if (patch.email && patch.email !== target.email) { row.email = patch.email; changed.push("email"); }
  if (patch.password) { row.password = await bcrypt.hash(patch.password, 10); changed.push("password"); }

  if (patch.roleId && patch.roleId !== target.role_id) {
    const role = await getRoleOrThrow(patch.roleId);
    assertCanActOnRank(actor, role.rank);
    await assertNotLastSuperAdmin(id);
    // role + role_id in the same update: the CHECK invariant must never be split.
    Object.assign(row, staffRoleColumns(role.key, role.id));
    changed.push("role");
  }

  if (!changed.length) return { ok: true };

  const { error } = await supabase.from("users").update(row).eq("id", id);
  if (error) throw new Error(isDuplicate(error.message) ? "That email is already in use" : error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.update",
    resourceType: "user",
    resourceId: id,
    summary: `Updated ${target.email} (${changed.join(", ")})`,
    metadata: { changed }, // field names only, never values
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Revoke admin access without deleting the account. This is the default: hard-deleting
 * a user nulls their orders' user_id and cascades their addresses/carts away.
 */
export async function revokeStaffAccess(id: string) {
  const actor = await authorize("users:manage");
  if (id === actor.id) throw new Error("you cannot revoke your own access");
  const target = await loadStaff(id);
  assertCanActOnRank(actor, await currentRank(target.role_id));
  await assertNotLastSuperAdmin(id);

  const { error } = await supabase.from("users").update(revokeAccessColumns()).eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.revoke",
    resourceType: "user",
    resourceId: id,
    summary: `Revoked admin access for ${target.email}`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteStaffUser(id: string) {
  const actor = await authorize("users:manage");
  if (id === actor.id) throw new Error("you cannot delete your own account");
  const target = await loadStaff(id);
  assertCanActOnRank(actor, await currentRank(target.role_id));
  await assertNotLastSuperAdmin(id);

  // Deleting orphans order history (orders.user_id is ON DELETE SET NULL). Refuse and
  // point at revoke instead, which keeps the trail intact.
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`${count} order(s) belong to this account — revoke access instead of deleting`);
  }

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.delete",
    resourceType: "user",
    resourceId: id,
    summary: `Deleted staff ${target.email}`,
    metadata: { email: target.email },
  });
  revalidatePath(PATH);
  return { ok: true };
}
