import { Users as UsersIcon } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { UsersTable } from "@/components/admin/UsersTable";
import { listAllUsers } from "@/lib/data/users";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function UsersPage() {
  // Contains customer PII (email/phone), so gate on customers:read — read-only staff
  // (who lack it by design) don't see this view.
  await requirePageAccess("customers:read");
  const users = await listAllUsers();
  const customers = users.filter((u) => !u.isStaff).length;
  const staff = users.length - customers;

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Everyone with an account — customers and staff" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total users" value={users.length} icon={<UsersIcon size={15} />} />
        <StatCard label="Customers" value={customers} icon={<UsersIcon size={15} />} />
        <StatCard label="Staff" value={staff} icon={<UsersIcon size={15} />} />
      </div>

      <UsersTable rows={users} />
    </div>
  );
}
