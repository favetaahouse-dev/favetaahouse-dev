import Link from "next/link";
import {
  Settings as SettingsIcon, Palette, ShieldCheck, ScrollText, Megaphone, CreditCard, Download, ChevronRight,
} from "lucide-react";
import { getCommerceSettings } from "@/lib/content";
import { skipcashEnabled, SKIPCASH_ENV } from "@/lib/skipcash";
import { PageHeader, Panel, SectionLabel, Badge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const links = [
  { href: "/admin/content/site-settings", label: "Site Settings", desc: "Contact details, socials & announcement bar", icon: SettingsIcon },
  { href: "/admin/content/commerce", label: "Commerce & Payments", desc: "Shipping, tax and order-email options", icon: CreditCard },
  { href: "/admin/content/materials-colors", label: "Materials & Colors", desc: "Storefront materials page content", icon: Palette },
  { href: "/admin/announcements", label: "Announcements", desc: "Storefront announcement bar & notices", icon: Megaphone },
  { href: "/admin/settings/users", label: "Staff & Roles", desc: "Team accounts and role permissions", icon: ShieldCheck },
  { href: "/admin/audit", label: "Activity Log", desc: "Admin activity & audit history", icon: ScrollText },
];

const exports = [
  { entity: "orders", label: "Orders" },
  { entity: "products", label: "Products" },
  { entity: "customers", label: "Customers" },
];

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border border-edge bg-canvas px-3 py-2.5 text-[13px]">
      <span className="text-secondary">{label}</span>
      <span className="flex items-center gap-2 text-foreground">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-positive" : "bg-warn"}`} />
        {value}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  const commerce = await getCommerceSettings();
  const emailConfigured = !!process.env.RESEND_API_KEY;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Store configuration, integrations and data" />

      <Panel className="p-5">
        <SectionLabel className="mb-3">System status</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusRow label="Payment provider" value={skipcashEnabled ? "SkipCash" : "Demo mode"} ok={skipcashEnabled} />
          <StatusRow
            label="SkipCash environment"
            value={skipcashEnabled ? SKIPCASH_ENV : "—"}
            ok={skipcashEnabled && SKIPCASH_ENV === "production"}
          />
          <StatusRow
            label="Order emails"
            value={commerce.emailEnabled ? (emailConfigured ? "On" : "On · no API key") : "Off"}
            ok={commerce.emailEnabled && emailConfigured}
          />
          <StatusRow label="Base currency" value="QAR" ok />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Gateway &amp; email keys are set via environment variables (see DEPLOY.md). Shipping, tax and the email
          toggle are editable under Commerce &amp; Payments.
        </p>
      </Panel>

      <div>
        <SectionLabel className="mb-3">Configuration</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-start gap-3 border border-edge bg-surface p-4 transition-colors hover:border-accent/60"
            >
              <l.icon size={18} strokeWidth={1.6} className="mt-0.5 text-accent" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{l.label}</p>
                  <ChevronRight size={15} className="text-faint transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-0.5 text-xs text-secondary">{l.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Panel className="p-5">
        <SectionLabel className="mb-3">Data export</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {exports.map((e) => (
            <a
              key={e.entity}
              href={`/api/admin/export/${e.entity}`}
              className="inline-flex items-center gap-2 border border-edge bg-elevated px-3.5 py-2 text-[13px] text-foreground transition-colors hover:border-accent/60"
            >
              <Download size={14} />
              {e.label} CSV
            </a>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
          <Badge tone="neutral">CSV</Badge> Exports reflect current data at time of download.
        </p>
      </Panel>
    </div>
  );
}
