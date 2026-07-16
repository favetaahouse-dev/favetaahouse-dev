import { getContent } from "@/lib/content";
import { PageHeader } from "@/components/admin/ui";
import { MediaManager } from "@/components/admin/MediaManager";
import { requirePageAccess } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requirePageAccess("content:write");
  const home = await getContent("home");
  return (
    <div>
      <PageHeader title="Videos" description="Control the hero & campaign videos shown on the storefront homepage" />
      <MediaManager initial={home} />
    </div>
  );
}
