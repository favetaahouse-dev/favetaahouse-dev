import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel, SectionLabel, Badge, EmptyState } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin-guard";
import { formatMoney } from "@/lib/money";
import {
  getUserById,
  getOrdersForUser,
  getUserLoginEvents,
  getUserAuditActions,
} from "@/lib/data/users";

const fmtDateTime = (s: string) => new Date(s).toLocaleString("en-US");
const fmtDate = (d: Date) => d.toLocaleDateString("en-US");

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-1 text-[13px] text-foreground">{value}</div>
    </div>
  );
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("customers:read");
  const { id } = await params;

  const user = await getUserById(id);
  if (!user) notFound();

  const [orders, logins, audit] = await Promise.all([
    getOrdersForUser(user.id, user.email),
    getUserLoginEvents(user.id),
    user.isStaff ? getUserAuditActions(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[13px] text-secondary hover:text-foreground">
        <ArrowLeft size={14} /> All users
      </Link>

      <PageHeader title={user.name ?? user.email} description={user.email} />

      <Panel className="p-5">
        <SectionLabel className="mb-4">Profile</SectionLabel>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Info label="Name" value={user.name ?? "—"} />
          <Info label="Email" value={user.email} />
          <Info label="Phone" value={user.phone ?? "—"} />
          <Info label="Role" value={<Badge tone={user.isStaff ? "accent" : "neutral"}>{user.roleName}</Badge>} />
          <Info
            label="Email verified"
            value={
              <Badge tone={user.verified ? "positive" : "warn"}>
                {user.verified ? (user.emailVerifiedAt ? fmtDateTime(user.emailVerifiedAt) : "Yes") : "No"}
              </Badge>
            }
          />
          <Info label="Joined" value={fmtDateTime(user.createdAt)} />
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionLabel className="mb-3">Orders ({orders.length})</SectionLabel>
        {orders.length === 0 ? (
          <EmptyState title="No orders" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-3 py-2.5 text-start">Order</th>
                  <th className="px-3 py-2.5 text-start">Status</th>
                  <th className="px-3 py-2.5 text-start">Date</th>
                  <th className="px-3 py-2.5 text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-edge/60">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/orders/${o.id}`} className="text-foreground hover:text-accent">#{o.number}</Link>
                    </td>
                    <td className="px-3 py-2.5"><Badge tone="neutral">{o.status}</Badge></td>
                    <td className="px-3 py-2.5 text-faint">{fmtDate(o.createdAt)}</td>
                    <td className="px-3 py-2.5 text-end">{formatMoney(o.total, "QAR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <SectionLabel className="mb-3">Login history</SectionLabel>
        {logins.length === 0 ? (
          <EmptyState title="No login records" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th className="px-3 py-2.5 text-start">When</th>
                  <th className="px-3 py-2.5 text-start">Result</th>
                  <th className="px-3 py-2.5 text-start">IP</th>
                  <th className="px-3 py-2.5 text-start">Device</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((l) => (
                  <tr key={l.id} className="border-b border-edge/60">
                    <td className="px-3 py-2.5 text-secondary">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={l.success ? "positive" : "danger"}>{l.success ? "Success" : "Failed"}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-faint">{l.ip ?? "—"}</td>
                    <td className="px-3 py-2.5 text-faint">
                      <span className="line-clamp-1 max-w-[280px]">{l.userAgent ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {user.isStaff && (
        <Panel className="p-5">
          <SectionLabel className="mb-3">Admin actions</SectionLabel>
          {audit.length === 0 ? (
            <EmptyState title="No recorded actions" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-edge text-[10px] uppercase tracking-[0.14em] text-faint">
                    <th className="px-3 py-2.5 text-start">When</th>
                    <th className="px-3 py-2.5 text-start">Action</th>
                    <th className="px-3 py-2.5 text-start">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-b border-edge/60">
                      <td className="px-3 py-2.5 text-secondary">{fmtDateTime(a.createdAt)}</td>
                      <td className="px-3 py-2.5"><Badge tone="accent">{a.action}</Badge></td>
                      <td className="px-3 py-2.5 text-secondary">{a.summary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
