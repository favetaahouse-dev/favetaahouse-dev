import { supabase } from "@/lib/supabase";
import { PageHeader, Panel, Badge, EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  action: string;
  actor_email: string | null;
  resource_type: string | null;
  resource_id: string | null;
  summary: string | null;
  created_at: string;
};

function whenLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AuditPage() {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, actor_email, resource_type, resource_id, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Log" description="Recent admin actions and changes across the store" />

      <Panel>
        <div className="border-b border-edge px-4 py-3">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-faint">Entries ({rows.length})</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No activity yet" description="Admin actions such as product edits, stock changes and order updates are recorded here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-4 py-3 text-start">When</th>
                  <th className="px-3 py-3 text-start">Actor</th>
                  <th className="px-3 py-3 text-start">Action</th>
                  <th className="px-3 py-3 text-start">Summary</th>
                  <th className="px-3 py-3 text-start">Resource</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-edge/60 text-foreground">
                    <td className="whitespace-nowrap px-4 py-2.5 text-faint">{whenLabel(r.created_at)}</td>
                    <td className="px-3 py-2.5 text-secondary">{r.actor_email ?? "system"}</td>
                    <td className="px-3 py-2.5"><Badge tone="neutral">{r.action}</Badge></td>
                    <td className="px-3 py-2.5">{r.summary ?? "—"}</td>
                    <td className="px-3 py-2.5 text-secondary">
                      {r.resource_type ? (
                        <span className="capitalize">
                          {r.resource_type}
                          {r.resource_id && <span className="ms-1 font-mono text-xs text-faint">#{r.resource_id.slice(0, 8)}</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
