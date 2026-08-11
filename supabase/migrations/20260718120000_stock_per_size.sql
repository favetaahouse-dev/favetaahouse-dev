-- Stock becomes a quantity per (product, colour, size). Length and Tack Tack stop being stock
-- axes and become made-to-order choices captured on the cart/order line. This collapses the
-- 12×2 matrix back to one row per colour+size (~447), restoring the real stock from the backup
-- the length migration made.
--
-- Non-breaking for the currently-deployed code: variants.length / variants.tack_tack are LEFT in
-- place (all rows at 50 / false) so old selects still work; a later migration can drop them.

-- ── 1. Restore real stock onto the anchor rows, then collapse ────────────────
update public.variants v
  set stock = b.stock, available = b.available
  from public.variants_backup_20260717 b
  where v.id = b.id;

delete from public.variants where length <> 50 or tack_tack <> false;

-- ── 2. Narrow the uniqueness key back to (product, colour, size) ─────────────
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.variants'::regclass and contype = 'u'
     and array_length(conkey, 1) = 5;      -- the (product,color,size,length,tack_tack) key
  if c is not null then execute format('alter table public.variants drop constraint %I', c); end if;
end $$;

alter table public.variants
  add constraint variants_product_id_color_size_key unique (product_id, color, size);

-- ── 3. cart_items carries the chosen length + tack-tack ─────────────────────
alter table public.cart_items
  add column if not exists length    integer,
  add column if not exists tack_tack boolean;

-- same size in two lengths / tack options = separate cart lines
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.cart_items'::regclass and contype = 'u'
     and array_length(conkey, 1) = 2;      -- the old (cart_id, variant_id) key
  if c is not null then execute format('alter table public.cart_items drop constraint %I', c); end if;
end $$;

alter table public.cart_items
  add constraint cart_items_cart_variant_choice_key unique (cart_id, variant_id, length, tack_tack);

-- ── 4. products.total_qty (advisory: size stocks are kept summing ≤ it) ──────
alter table public.products add column if not exists total_qty integer not null default 0;
update public.products p
  set total_qty = coalesce((select sum(stock) from variants where product_id = p.id), 0);

-- ── 5. create_order: snapshot length + tack_tack from the CART LINE, not the variant ──
-- Byte-identical to 20260717120000's version except the two order_items source columns.
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
  v_ship_fee   numeric := 0;
  v_free_thr   numeric := 0;
  v_tax_rate   numeric := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty';
  end if;

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

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    insert into order_items (order_id, variant_id, title, color, size, length, tack_tack, sku, price, quantity, image_url)
    select v_order_id, v.id, p.title, v.color, v.size,
           nullif(v_item->>'length', '')::integer, (v_item->>'tack_tack')::boolean,
           v.sku, v.price, v_qty,
           coalesce(v.image_url, (select url from product_images pi where pi.product_id = v.product_id order by position limit 1))
    from variants v join products p on p.id = v.product_id
    where v.id = v_variant_id;
  end loop;

  return jsonb_build_object('id', v_order_id, 'subtotal', v_subtotal, 'discount', v_discount, 'shipping', v_shipping, 'tax', v_tax, 'total', v_total);
end;
$$;

grant execute on function public.create_order(text, uuid, jsonb, text, jsonb, text) to service_role;

-- ── 6. generate_variants: colour × size only ────────────────────────────────
drop function if exists public.generate_variants(uuid, jsonb, text[], integer[], boolean[], integer, integer);

create or replace function public.generate_variants(
  p_product_id uuid,
  p_colors     jsonb,        -- [{"name":"Black","hex":"#000000"}, ...]
  p_sizes      text[],
  p_price      integer,
  p_stock      integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after  integer;
begin
  select count(*) into v_before from variants where product_id = p_product_id;

  insert into variants (product_id, color, color_hex, size, price, compare_at, stock, available, position)
  select p_product_id, (c->>'name'), (c->>'hex'), s,
         greatest(coalesce(p_price, 0), 0), null,
         greatest(coalesce(p_stock, 0), 0), (greatest(coalesce(p_stock, 0), 0) > 0), 0
  from jsonb_array_elements(p_colors) as c
  cross join unnest(p_sizes) as s
  on conflict (product_id, color, size) do nothing;

  select count(*) into v_after from variants where product_id = p_product_id;

  with ordered as (
    select id, row_number() over (
      partition by product_id
      order by color, coalesce(array_position(array['XS','S','M','L','XL','XXL','One Size'], size), 99)
    ) - 1 as pos
    from variants where product_id = p_product_id
  )
  update variants v set position = o.pos from ordered o where o.id = v.id;

  update products p
    set price_min = coalesce((select min(price) from variants where product_id = p_product_id), 0),
        price_max = coalesce((select max(price) from variants where product_id = p_product_id), 0)
    where p.id = p_product_id;

  return v_after - v_before;
end;
$$;

grant execute on function public.generate_variants(uuid, jsonb, text[], integer, integer) to service_role;
