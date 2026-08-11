export type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number; // PERCENT: 0-100 ; FIXED: cents
  min_spend: number; // cents
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

export function couponValid(c: Coupon, subtotal: number, nowMs: number): boolean {
  if (!c.active) return false;
  if (c.starts_at && new Date(c.starts_at).getTime() > nowMs) return false;
  if (c.expires_at && new Date(c.expires_at).getTime() < nowMs) return false;
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return false;
  if (subtotal < c.min_spend) return false;
  return true;
}

/** Discount in cents for a coupon against a cents subtotal (0 if invalid). */
export function computeDiscount(c: Coupon, subtotal: number, nowMs: number): number {
  if (!couponValid(c, subtotal, nowMs)) return 0;
  return c.type === "PERCENT"
    ? Math.floor((subtotal * c.value) / 100)
    : Math.min(c.value, subtotal);
}
