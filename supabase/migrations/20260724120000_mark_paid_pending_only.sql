-- Harden mark_order_paid idempotency: only the genuine PENDING->PAID transition runs the side
-- effects. The prior guard blocklisted PAID/FULFILLED but let CANCELLED and REFUNDED fall
-- through, so a replayed webhook/return could un-cancel/un-refund an order, double-decrement
-- stock, double-bump coupon usage, and resend the confirmation email.
create or replace function public.mark_order_paid(
  p_order_id  uuid,
  p_cart_id   text default null,
  p_provider  text default null,
  p_reference text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_code   text;
  v_it     record;
begin
  select status, coupon_code into v_status, v_code from orders where id = p_order_id for update;
  if not found or v_status <> 'PENDING' then return false; end if;

  for v_it in select variant_id, quantity from order_items where order_id = p_order_id and variant_id is not null loop
    update variants
      set stock = greatest(stock - v_it.quantity, 0),
          available = (greatest(stock - v_it.quantity, 0) > 0)
      where id = v_it.variant_id;
  end loop;

  update orders
    set status = 'PAID',
        payment_provider = coalesce(p_provider, payment_provider),
        payment_ref = coalesce(p_reference, payment_ref),
        paid_at = now()
    where id = p_order_id;

  if v_code is not null then
    update coupons set used_count = used_count + 1 where code = v_code;
  end if;

  if p_cart_id is not null and length(p_cart_id) > 0 then
    delete from cart_items where cart_id = p_cart_id::uuid;
  end if;

  return true;
end;
$$;

grant execute on function public.mark_order_paid(uuid, text, text, text) to service_role;
