import Link from "next/link";
import { PageHeader, Panel, EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Where `requirePageAccess` lands a staff member who lacks a page's permission. */
export default function ForbiddenPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="No access" description="You don't have permission to view that page" />
      <Panel>
        <EmptyState
          title="Not your pay grade"
          description="Your role doesn't include the permission this page needs. If you think that's wrong, ask an administrator to update your role."
          action={
            <Link
              href="/admin"
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Back to dashboard
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
