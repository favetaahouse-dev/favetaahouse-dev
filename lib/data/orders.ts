import "server-only";
import { supabase } from "@/lib/supabase";
import { asMeasurements, isUnit, type Measurements, type Unit } from "@/lib/measurements";

export type OrderItemDTO = {
  id: string;
  variantId: string | null;
  productId: string | null;
  /** 'MTO' lines have no variant and no size — they carry measurements instead. */
  fulfillment: "RTW" | "MTO";
  title: string;
  color: string;
  size: string | null;
  length: number | null;
  tackTack: boolean | null;
  measurements: Measurements | null;
  measureUnit: Unit | null;
  notes: string | null;
  /** The lead time PROMISED at checkout, snapshotted — not whatever the product says today. */
  leadMinDays: number | null;
  leadMaxDays: number | null;
  sku: string | null;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type OrderDTO = {
  id: string;
  number: number;
  userId: string | null;
  email: string;
  status: string;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  trackingNumber: string | null;
  paymentProvider: string | null;
  paymentRef: string | null;
  paidAt: Date | null;
  shippingAddress: Record<string, unknown> | null;
  /** Ad-network click attribution captured at checkout — see the migration for why it exists. */
  marketingAttribution: Record<string, unknown> | null;
  createdAt: Date;
  items: OrderItemDTO[];
};

const ORDER_SELECT = "*, items:order_items(*)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(o: any): OrderDTO {
  return {
    id: o.id,
    number: o.number,
    userId: o.user_id ?? null,
    email: o.email,
    status: o.status,
    currency: o.currency,
    subtotal: o.subtotal,
    discount: o.discount ?? 0,
    shipping: o.shipping ?? 0,
    tax: o.tax ?? 0,
    total: o.total,
    couponCode: o.coupon_code ?? null,
    trackingNumber: o.tracking_number ?? null,
    paymentProvider: o.payment_provider ?? null,
    paymentRef: o.payment_ref ?? null,
    paidAt: o.paid_at ? new Date(o.paid_at) : null,
    shippingAddress: o.shipping_address ?? null,
    marketingAttribution: o.marketing_attribution ?? null,
    createdAt: new Date(o.created_at),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      variantId: it.variant_id ?? null,
      productId: it.product_id ?? null,
      fulfillment: it.fulfillment === "MTO" ? "MTO" : "RTW",
      title: it.title,
      color: it.color,
      size: it.size ?? null,
      length: it.length ?? null,
      tackTack: it.tack_tack ?? null,
      measurements: asMeasurements(it.measurements),
      measureUnit: isUnit(it.measure_unit) ? it.measure_unit : null,
      notes: it.notes ?? null,
      leadMinDays: it.lead_min_days ?? null,
      leadMaxDays: it.lead_max_days ?? null,
      sku: it.sku ?? null,
      price: it.price,
      quantity: it.quantity,
      imageUrl: it.image_url ?? null,
    })),
  };
}

export async function getOrder(id: string): Promise<OrderDTO | null> {
  const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  return data ? mapOrder(data) : null;
}

/**
 * order_items.id → products.handle, for Meta's `content_ids`.
 *
 * Its own query rather than widening ORDER_SELECT: that select feeds receipts, order emails and
 * the admin order list, none of which need a two-level join to products. Paying for it there
 * would slow every one of them for the benefit of one marketing call.
 *
 * A missing entry is normal, not an error — order_items.product_id is ON DELETE SET NULL, so an
 * order that outlived its product simply has no handle to report. Callers must tolerate that.
 *
 * It reads order_items.product_id DIRECTLY. Routing through variants — which is what this did —
 * returns nothing for a made-to-order line, because those have no variant at all: every
 * made-to-order purchase would have reported content_ids: [] to Meta. Going through the product
 * is also one join level instead of two, and survives a deleted variant, which the two-level
 * version never did.
 */
export async function getOrderItemHandles(orderId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { data, error } = await supabase
    .from("order_items")
    .select("id, product:products(handle)")
    .eq("order_id", orderId);
  if (error) {
    console.error("[orders] handle lookup failed", orderId, error.message);
    return out;
  }
  for (const row of data ?? []) {
    // PostgREST returns the nested relation as an object for a to-one FK.
    const handle = (row as unknown as { product?: { handle?: string } | null }).product?.handle;
    if (handle) out.set(row.id as string, handle);
  }
  return out;
}

export async function getUserOrders(userId: string): Promise<OrderDTO[]> {
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapOrder);
}
