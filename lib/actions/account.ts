"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { authorize } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

// Kept parallel to lib/actions/users.ts rather than imported: a "use server" module
// may only export async functions, so the schemas can't be shared across the boundary.
const emailSchema = z.string().email().max(200).transform((s) => s.toLowerCase().trim());
const passwordSchema = z.string().min(12, "Use at least 12 characters").max(200);

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  email: emailSchema.optional(),
  newPassword: passwordSchema.optional(),
});

/** Postgres unique_violation — the only update error worth a friendly message. */
const isDuplicate = (msg: string) => /duplicate key|23505/i.test(msg);

/**
 * Self-service credential change for the logged-in admin. Operates strictly on the
 * session actor's own row — identity comes from the session, never from the client,
 * so there is no rank check and no `users:manage` requirement (any staff may edit self).
 * The current password is re-verified before any change goes through.
 */
export async function updateOwnCredentials(input: z.input<typeof schema>) {
  const actor = await authorize();

  // Blunt current-password guessing. Keyed on the actor, not the IP, so it can't be
  // reset by rotating IPs. Fails open (see lib/rate-limit.ts).
  if (!(await rateLimit(`admin_creds:${actor.id}`, 5, 300))) {
    throw new Error("Too many attempts — try again in a few minutes");
  }

  const { currentPassword, email, newPassword } = schema.parse(input);

  const { data: me } = await supabase
    .from("users")
    .select("email, password")
    .eq("id", actor.id)
    .maybeSingle();
  if (!me?.password) throw new Error("unauthorized");

  // Re-verify the current password before allowing an email or password change.
  if (!(await bcrypt.compare(currentPassword, me.password))) {
    throw new Error("Current password is incorrect");
  }

  const changed: string[] = [];
  const row: Database["public"]["Tables"]["users"]["Update"] = {};
  if (email && email !== me.email) { row.email = email; changed.push("email"); }
  if (newPassword) { row.password = await bcrypt.hash(newPassword, 10); changed.push("password"); }

  if (!changed.length) return { ok: true as const, changed };

  const { error } = await supabase.from("users").update(row).eq("id", actor.id);
  if (error) throw new Error(isDuplicate(error.message) ? "That email is already in use" : error.message);

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.credentials.update",
    resourceType: "user",
    resourceId: actor.id,
    summary: `Updated own login (${changed.join(", ")})`,
    metadata: { changed }, // field names only, never values
  });

  return { ok: true as const, changed };
}
