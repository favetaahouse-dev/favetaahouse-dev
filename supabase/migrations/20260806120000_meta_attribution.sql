-- Marketing click attribution, captured in the browser at checkout and persisted on the order.
--
-- WHY IT HAS TO BE STORED AT ALL. The authoritative Purchase event is sent server-side from
-- lib/actions/checkout.ts:markOrderPaid(), which is reached from the SkipCash webhook. In that
-- request the IP, user-agent and cookies belong to SKIPCASH, not to the shopper — so the Meta
-- Conversions API event would carry no _fbp, no _fbc and a wrong IP, and Event Match Quality
-- collapses. Capturing at checkout (a real browser request) and reading it back at fulfilment is
-- the only way the server event can describe the actual human.
--
-- WHY ON `orders` AND NOT SOMEWHERE ELSE:
--   * NOT payments.raw — app/api/skipcash/webhook/route.ts overwrites `raw` with the SkipCash
--     payload BEFORE it calls markOrderPaid, so anything stashed there is destroyed at exactly
--     the moment it would be read.
--   * NOT a payments column — that table is the gateway audit trail, and `manual` back-office
--     orders never get a payments row at all.
--   * NOT a create_order parameter — that RPC is `security definer` and its `grant execute` is
--     bound to its exact signature; changing it means re-granting and regenerating types.
--   * `orders` already gets an UPDATE during checkout (payment_provider/payment_ref), so this
--     rides along on a statement that was happening anyway. Zero extra round trips.
--
-- Namespaced by network so a future TikTok or Snap pixel needs no second migration.
alter table public.orders
  add column if not exists marketing_attribution jsonb;

comment on column public.orders.marketing_attribution is
  'Ad-network click attribution captured at checkout, e.g. {"meta":{"fbp":"fb.1...","fbc":"fb.1...","ip":"1.2.3.4","ua":"Mozilla/5.0...","url":"https://...","ts":1234567890}}. Read back by the server-side Conversions API Purchase, which fires from a webhook where the request is the payment provider''s, not the shopper''s.';
