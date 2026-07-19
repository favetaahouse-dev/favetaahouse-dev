import { getContent } from "@/lib/content";
import { PageHeader } from "@/components/admin/ui";
import { MediaManager } from "@/components/admin/MediaManager";
import { requirePageAccess } from "@/lib/admin-guard";

export default async function MediaPage() {
  await requirePageAccess("content:write");
  const home = await getContent("home");
  return (
    <div>
      <PageHeader title="Media" description="Hero video and the homepage gallery images shown on the storefront" />
      <MediaManager initial={home} />
    </div>
  );
}
