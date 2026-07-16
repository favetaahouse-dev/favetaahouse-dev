import { Star } from "lucide-react";
import { PageHeader, Panel, StatCard, EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" description="Customer product reviews and ratings" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total reviews" value={0} icon={<Star size={15} />} />
        <StatCard label="Average rating" value="—" icon={<Star size={15} />} />
        <StatCard label="Pending" value={0} icon={<Star size={15} />} />
        <StatCard label="Published" value={0} icon={<Star size={15} />} />
      </div>

      <Panel>
        <EmptyState
          title="No reviews yet"
          description="Product reviews aren't being collected in the store yet. Once the storefront review form is connected, submissions will appear here for moderation."
        />
      </Panel>
    </div>
  );
}
