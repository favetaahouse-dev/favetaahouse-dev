import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/admin-guard";
import { getOrder } from "@/lib/data/orders";
import { getCommerceSettings, getSiteSettings } from "@/lib/content";
import { renderReceiptHtml } from "@/lib/receipt";
import { PrintButton } from "@/components/admin/OrderReceiptActions";

// The `.receipt-print` isolation CSS lets the white receipt print alone, without the dark
// admin shell around it — no changes to AdminShell needed.
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  .receipt-print, .receipt-print * { visibility: visible !important; }
  .receipt-print { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}`;

export default async function AdminOrderReceipt({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("orders:read");
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const [commerce, site] = await Promise.all([getCommerceSettings(), getSiteSettings()]);
  const html = renderReceiptHtml(order, {
    taxLabel: commerce.taxLabel,
    storeLocation: site.storeLocation ?? "Doha, Qatar",
    contactEmail: site.contactEmail ?? "",
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center gap-4">
        <Link href={`/admin/orders/${order.id}`} className="text-xs text-signal hover:underline">
          ← Back to order
        </Link>
        <PrintButton />
      </div>
      <div className="receipt-print" dangerouslySetInnerHTML={{ __html: html }} />
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
    </div>
  );
}
