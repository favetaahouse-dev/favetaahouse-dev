"use client";

import { useState } from "react";
import { Pencil, Plus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ui/Modal";
import { Can } from "@/components/admin/ui/PermissionGate";
import { Badge, Button, EmptyState, IconButton, Panel } from "@/components/admin/ui/primitives";
import { revokeStaffAccess } from "@/lib/actions/users";
import { StaffFormModal, type RoleOption, type StaffEditTarget } from "./StaffFormModal";

export type StaffRow = {
  id: string;
  email: string;
  name: string | null;
  roleId: string | null;
  roleName: string;
  roleRank: number;
  createdAt: string;
};

export function StaffTable({
  staff,
  roles,
  actorId,
  actorRank,
  actorIsSuper,
}: {
  staff: StaffRow[];
  roles: RoleOption[];
  actorId: string;
  actorRank: number;
  actorIsSuper: boolean;
}) {
  const [editing, setEditing] = useState<StaffEditTarget>(null);
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState<StaffRow | null>(null);

  // Mirrors assertCanActOnRank on the server: strictly-lower ranks only. This is UX —
  // the server check is the real boundary.
  const canActOn = (r: StaffRow) => actorIsSuper || actorRank > r.roleRank;
  const assignable = roles.filter((r) => actorIsSuper || r.rank < actorRank);

  // Catch here: ConfirmDialog only closes if onConfirm resolves.
  const onRevoke = async () => {
    if (!revoking) return;
    try {
      await revokeStaffAccess(revoking.id);
      toast.success(`Revoked admin access for ${revoking.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke access");
    }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="text-[10px] uppercase tracking-[0.16em] text-faint">Staff members ({staff.length})</h2>
        <Can permission="users:manage">
          <Button variant="primary" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus size={14} /> Add staff
          </Button>
        </Can>
      </div>

      {staff.length === 0 ? (
        <EmptyState title="No staff accounts" description="Users with any non-customer role appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                <th className="px-4 py-3 text-start">Name</th>
                <th className="px-3 py-3 text-start">Email</th>
                <th className="px-3 py-3 text-start">Role</th>
                <th className="px-3 py-3 text-start">Joined</th>
                <th className="px-3 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => {
                const isSelf = u.id === actorId;
                const allowed = canActOn(u);
                return (
                  <tr key={u.id} className="border-b border-edge/60 text-foreground">
                    <td className="px-4 py-2.5">
                      {u.name ?? "—"}
                      {isSelf && <span className="ms-2 text-[11px] text-faint">(you)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-secondary">{u.email}</td>
                    <td className="px-3 py-2.5"><Badge tone="accent">{u.roleName}</Badge></td>
                    <td className="px-3 py-2.5 text-faint">{new Date(u.createdAt).toLocaleDateString("en-US")}</td>
                    <td className="px-3 py-2.5">
                      <Can permission="users:manage">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            aria-label="Edit"
                            disabled={!allowed}
                            title={allowed ? "Edit" : "This role outranks yours"}
                            onClick={() => {
                              setEditing({ id: u.id, email: u.email, name: u.name, roleId: u.roleId });
                              setOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="Revoke access"
                            disabled={!allowed || isSelf}
                            title={isSelf ? "You cannot revoke your own access" : "Revoke admin access"}
                            onClick={() => setRevoking(u)}
                          >
                            <UserMinus size={14} />
                          </IconButton>
                        </div>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <StaffFormModal open={open} onClose={() => setOpen(false)} target={editing} roles={assignable} />

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={onRevoke}
        title="Revoke admin access?"
        confirmLabel="Revoke access"
        danger
        body={`${revoking?.email ?? ""} becomes a normal customer and loses the admin panel. Their account, orders and history are kept.`}
      />
    </Panel>
  );
}
