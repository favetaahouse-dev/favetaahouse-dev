import { PageHeader, Panel, SectionLabel } from "@/components/admin/ui";
import { AccountSecurityForm } from "@/components/admin/settings/AccountSecurityForm";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function AccountPage() {
  // Staff-only, no special permission: every admin may change their own login.
  const actor = await requirePageAccess();

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" description="Change the email and password you sign in with" />
      <Panel className="p-5">
        <SectionLabel className="mb-3">Login &amp; security</SectionLabel>
        <AccountSecurityForm currentEmail={actor.email} />
      </Panel>
    </div>
  );
}
