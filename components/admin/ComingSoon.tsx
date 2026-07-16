import { PageHeader } from "@/components/admin/ui/primitives";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-2 border border-edge bg-surface px-6 py-24 text-center">
        <p className="text-sm font-medium text-foreground">Coming soon</p>
        <p className="max-w-sm text-xs text-secondary">
          This section is part of the ongoing control-center build and will be enabled in an upcoming update.
        </p>
      </div>
    </div>
  );
}
