"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Can } from "@/components/admin/ui/PermissionGate";
import { Badge, Button, Panel } from "@/components/admin/ui/primitives";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import { setRolePermissions } from "@/lib/actions/roles";

export type MatrixRole = {
  id: string;
  key: string;
  name: string;
  rank: number;
  isSystem: boolean;
  permissions: string[];
};

const SUPER = "super_admin";

/** Group `resource:action` by resource so the rows read as a handful of blocks. */
const GROUPS: Record<string, Permission[]> = (() => {
  const out: Record<string, Permission[]> = {};
  for (const p of PERMISSIONS) (out[p.split(":")[0]] ??= []).push(p);
  return out;
})();

const label = (p: string) => p.split(":")[1].replace(/_/g, " ");
const title = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function RolePermissionMatrix({
  roles,
  actorRank,
  actorIsSuper,
}: {
  roles: MatrixRole[];
  actorRank: number;
  actorIsSuper: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.id, new Set(r.permissions)])),
  );
  const [saving, setSaving] = useState<string | null>(null);

  // super_admin bypasses can() in code, so its rows are decorative — never editable.
  // Otherwise mirror assertCanActOnRank: strictly-lower ranks only.
  const editable = (r: MatrixRole) => r.key !== SUPER && (actorIsSuper || actorRank > r.rank);

  const dirty = (r: MatrixRole) => {
    const now = draft[r.id] ?? new Set<string>();
    const was = new Set(r.permissions);
    if (now.size !== was.size) return true;
    for (const p of now) if (!was.has(p)) return true;
    return false;
  };

  const toggle = (roleId: string, perm: string) =>
    setDraft((d) => {
      const next = new Set(d[roleId]);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...d, [roleId]: next };
    });

  const save = async (r: MatrixRole) => {
    setSaving(r.id);
    try {
      const res = await setRolePermissions(r.id, [...(draft[r.id] ?? [])]);
      toast.success(`${r.name}: +${res.added} / −${res.removed} permissions. Takes effect within a minute.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save permissions");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Panel>
      <div className="border-b border-edge px-4 py-3">
        <h2 className="text-[10px] uppercase tracking-[0.16em] text-faint">Role permissions</h2>
        <p className="mt-1 text-[11px] text-faint">
          Changes apply to signed-in staff within about a minute.
        </p>
      </div>

      <Can
        permission="roles:manage"
        fallback={
          <p className="px-4 py-6 text-[13px] text-secondary">
            You don&apos;t have permission to change role permissions.
          </p>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                <th className="px-4 py-3 text-start">Permission</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{r.name}</span>
                      {!editable(r) && (
                        <Badge tone={r.key === SUPER ? "accent" : "neutral"}>
                          {r.key === SUPER ? "All" : "Locked"}
                        </Badge>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(GROUPS).map(([resource, perms]) => (
                <Fragment key={resource}>
                  <tr className="bg-elevated/40">
                    <td
                      colSpan={roles.length + 1}
                      className="px-4 py-1.5 text-[10px] uppercase tracking-[0.14em] text-faint"
                    >
                      {title(resource)}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p} className="border-b border-edge/60">
                      <td className="px-4 py-2 text-secondary">{label(p)}</td>
                      {roles.map((r) => (
                        <td key={r.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${r.name}: ${p}`}
                            className="h-3.5 w-3.5 accent-[var(--accent)] disabled:opacity-40"
                            disabled={!editable(r)}
                            checked={r.key === SUPER ? true : (draft[r.id]?.has(p) ?? false)}
                            onChange={() => toggle(r.id, p)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-edge px-4 py-3">
          {roles.filter((r) => editable(r) && dirty(r)).map((r) => (
            <Button key={r.id} variant="primary" disabled={saving === r.id} onClick={() => save(r)}>
              {saving === r.id ? "Saving…" : `Save ${r.name}`}
            </Button>
          ))}
        </div>
      </Can>
    </Panel>
  );
}
