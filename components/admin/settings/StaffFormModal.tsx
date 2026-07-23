"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Modal } from "@/components/admin/ui/Modal";
import { Form, SelectField, SubmitButton, TextField, useZodForm } from "@/components/admin/ui/form";
import { Button } from "@/components/admin/ui/primitives";
import { createStaffUser, updateStaffUser } from "@/lib/actions/users";

export type StaffEditTarget = {
  id: string;
  email: string;
  name: string | null;
  roleId: string | null;
} | null;

export type RoleOption = { id: string; key: string; name: string; rank: number };

// Blank password means "keep the current one" on edit; onSubmit rejects it on create.
const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  email: z.string().email("Enter a valid email"),
  roleId: z.string().uuid("Pick a role"),
  password: z.union([z.string().min(12, "Use at least 12 characters"), z.literal("")]),
});

type Values = z.infer<typeof schema>;

export function StaffFormModal({
  open,
  onClose,
  target,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  target: StaffEditTarget;
  /** Already filtered to ranks the actor outranks. */
  roles: RoleOption[];
}) {
  const isEdit = !!target;
  // New staff default to the least-privileged read-only role, per policy.
  const defaultRoleId = roles.find((r) => r.key === "read_only")?.id ?? roles[0]?.id ?? "";
  const form = useZodForm<Values>(schema, {
    name: target?.name ?? "",
    email: target?.email ?? "",
    roleId: target?.roleId ?? defaultRoleId,
    password: "",
  });

  // The modal is mounted once and reused, so reset when the target changes.
  useEffect(() => {
    if (open) {
      form.reset({
        name: target?.name ?? "",
        email: target?.email ?? "",
        roleId: target?.roleId ?? defaultRoleId,
        password: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  const onSubmit = async (v: Values) => {
    try {
      if (isEdit) {
        await updateStaffUser(target!.id, {
          name: v.name,
          email: v.email,
          roleId: v.roleId,
          ...(v.password ? { password: v.password } : {}),
        });
        toast.success("Staff member updated");
      } else {
        if (!v.password) {
          form.setError("password", { message: "Required for a new account" });
          return;
        }
        await createStaffUser({ name: v.name, email: v.email, roleId: v.roleId, password: v.password });
        toast.success("Staff member created");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  if (!roles.length) {
    return (
      <Modal open={open} onClose={onClose} title="No assignable roles">
        <p className="text-[13px] text-secondary">
          You can only assign roles ranked below your own, and there aren&apos;t any.
        </p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit staff member" : "Add staff member"}>
      <Form form={form} onSubmit={onSubmit} className="space-y-4">
        <TextField<Values> name="name" label="Name" placeholder="Jane Doe" />
        <TextField<Values> name="email" label="Email" type="email" placeholder="jane@alessiaabaya.com" />
        <SelectField<Values>
          name="roleId"
          label="Role"
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          hint="Only roles below your own rank are listed."
        />
        <TextField<Values>
          name="password"
          label={isEdit ? "New password" : "Password"}
          type="password"
          hint={isEdit ? "Leave blank to keep the current password." : "At least 12 characters."}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <SubmitButton>{isEdit ? "Save changes" : "Create"}</SubmitButton>
        </div>
      </Form>
    </Modal>
  );
}
