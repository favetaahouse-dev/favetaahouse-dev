"use client";

import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { z } from "zod";
import { Form, SubmitButton, TextField, useZodForm } from "@/components/admin/ui/form";
import { updateOwnCredentials } from "@/lib/actions/account";

// Blank newPassword means "keep the current password". confirmPassword only has to
// match when a new password is actually being set.
const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    email: z.string().email("Enter a valid email"),
    newPassword: z.union([z.string().min(12, "Use at least 12 characters"), z.literal("")]),
    confirmPassword: z.string(),
  })
  .refine((v) => !v.newPassword || v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type Values = z.infer<typeof schema>;

export function AccountSecurityForm({ currentEmail }: { currentEmail: string }) {
  const form = useZodForm<Values>(schema, {
    currentPassword: "",
    email: currentEmail,
    newPassword: "",
    confirmPassword: "",
  });

  const onSubmit = async (v: Values) => {
    try {
      const res = await updateOwnCredentials({
        currentPassword: v.currentPassword,
        email: v.email,
        ...(v.newPassword ? { newPassword: v.newPassword } : {}),
      });
      if (!res.changed.length) {
        toast("No changes to save");
        return;
      }
      toast.success("Credentials updated — sign in again");
      // The JWT still carries the old email (refreshAccess only re-reads role/perms),
      // so drop the session and force a fresh login with the new credentials.
      await signOut({ callbackUrl: "/admin/login" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <Form form={form} onSubmit={onSubmit} className="max-w-md space-y-4">
      <TextField<Values>
        name="currentPassword"
        label="Current password"
        type="password"
        hint="Required to confirm any change."
      />
      <TextField<Values>
        name="email"
        label="Login email"
        type="email"
        hint="This is the email you sign in with."
      />
      <TextField<Values>
        name="newPassword"
        label="New password"
        type="password"
        hint="Leave blank to keep your current password. At least 12 characters."
      />
      <TextField<Values> name="confirmPassword" label="Confirm new password" type="password" />
      <div className="pt-1">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </Form>
  );
}
