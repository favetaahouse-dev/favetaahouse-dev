-- Atomic commerce operations as Postgres functions (PostgREST has no multi-statement txns).

-- create_order: validate stock + coupon, recompute totals from DB, insert order + items.
-- p_items = jsonb array of { variant_id, quantity }.
create or replace function public.create_order(
  p_email    text,
  p_user_id  uuid,
  p_address  jsonb,
  p_currency text,
  p_items    jsonb,
  p_coupon   text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item       jsonb;
  v_variant_id uuid;
  v_qty        integer;
  v_v          record;
  v_subtotal   integer := 0;
  v_discount   integer := 0;
  v_net        integer;
  v_shipping   integer := 0;
  v_tax        integer := 0;
  v_total      integer;
  v_order_id   uuid;
  v_coupon     record;
  v_code       text := null;
  v_settings   jsonb;
  v_ship_fee   numeric := 0;   -- QAR major units (from CMS)
  v_free_thr   numeric := 0;   -- QAR major units
  v_tax_rate   numeric := 0;   -- percent
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty';
  end if;

  -- validate + subtotal (lock variant rows)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty < 1 then raise exception 'qty'; end if;
    select * into v_v from variants where id = v_variant_id for update;
    if not found or not v_v.available or v_v.stock < v_qty then
      raise exception 'stock';
    end if;
    v_subtotal := v_subtotal + v_v.price * v_qty;
  end loop;

  -- coupon (optional)
  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon from coupons where code = upper(trim(p_coupon)) and active for update;
    if found
       and (v_coupon.starts_at is null or v_coupon.starts_at <= now())
       and (v_coupon.expires_at is null or v_coupon.expires_at >= now())
       and (v_coupon.usage_limit is null or v_coupon.used_count < v_coupon.usage_limit)
       and v_subtotal >= v_coupon.min_spend then
      v_code := upper(trim(p_coupon));
      if v_coupon.type = 'PERCENT' then
        v_discount := (v_subtotal * v_coupon.value) / 100;
      else
        v_discount := least(v_coupon.value, v_subtotal);
      end if;
    end if;
  end if;

  v_net := greatest(v_subtotal - v_discount, 0);

  -- shipping + tax from admin commerce settings (CMS stores QAR major units + percent)
  select data into v_settings from content where key = 'commerce';
  if v_settings is not null then
    v_ship_fee := coalesce(nullif(v_settings->>'shippingFee', '')::numeric, 0);
    v_free_thr := coalesce(nullif(v_settings->>'freeShippingThreshold', '')::numeric, 0);
    v_tax_rate := coalesce(nullif(v_settings->>'taxRate', '')::numeric, 0);
  end if;

  if v_free_thr > 0 and v_net >= round(v_free_thr * 100) then
    v_shipping := 0;
  else
    v_shipping := round(v_ship_fee * 100);
  end if;
  v_tax := round(v_net * v_tax_rate / 100);
  v_total := v_net + v_shipping + v_tax;

  insert into orders (user_id, email, status, currency, subtotal, discount, shipping, tax, total, coupon_code, shipping_address)
  values (p_user_id, p_email, 'PENDING', coalesce(p_currency, 'QAR'), v_subtotal, v_discount, v_shipping, v_tax, v_total, v_code, p_address)
  returning id into v_order_id;

  -- snapshot line items
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    insert into order_items (order_id, variant_id, title, color, size, sku, price, quantity, image_url)
    select v_order_id, v.id, p.title, v.color, v.size, v.sku, v.price, v_qty,
           coalesce(v.image_url, (select url from product_images pi where pi.product_id = v.product_id order by position limit 1))
    from variants v join products p on p.id = v.product_id
    where v.id = v_variant_id;
  end loop;

  return jsonb_build_object('id', v_order_id, 'subtotal', v_subtotal, 'discount', v_discount, 'shipping', v_shipping, 'tax', v_tax, 'total', v_total);
end;
$$;

-- mark_order_paid: idempotent — decrement stock, set PAID, bump coupon usage, clear cart.
-- Returns true only on the real PENDING->PAID transition (so the caller emails once).
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
  if not found or v_status in ('PAID', 'FULFILLED') then return false; end if;

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

-- price_range: catalog min/max for filters.
create or replace function public.price_range()
returns table(min integer, max integer)
language sql stable
security definer
set search_path = public
as $$
  select coalesce(min(price_min), 0)::integer, coalesce(max(price_max), 390000)::integer from products;
$$;

grant execute on function public.create_order(text, uuid, jsonb, text, jsonb, text) to service_role;
grant execute on function public.mark_order_paid(uuid, text, text, text) to service_role;
grant execute on function public.price_range() to service_role;
