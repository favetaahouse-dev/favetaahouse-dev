import "server-only";
import { supabase } from "@/lib/supabase";

export type OrderItemDTO = {
  id: string;
  variantId: string | null;
  title: string;
  color: string;
  size: string;
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
    createdAt: new Date(o.created_at),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      variantId: it.variant_id ?? null,
      title: it.title,
      color: it.color,
      size: it.size,
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

export async function getUserOrders(userId: string): Promise<OrderDTO[]> {
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapOrder);
}
