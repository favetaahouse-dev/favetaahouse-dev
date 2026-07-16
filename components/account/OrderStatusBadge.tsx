const STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  FULFILLED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-neutral-200 text-neutral-700",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-neutral-200 text-neutral-700"}`}>{status}</span>
  );
}
