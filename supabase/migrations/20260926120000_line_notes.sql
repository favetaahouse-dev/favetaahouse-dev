-- A note on every line. The product page now offers a free-text note beside the size choices,
-- for ready-to-wear as well as made-to-order — before this, only made-to-order lines carried one.
-- cart_items.notes and order_items.notes already exist (20260816120000_made_to_order.sql); what
-- changes is that ready-to-wear lines fill them too.
--
-- APPLY BEFORE DEPLOYING THE APP, after 20260925120000_mto_size_length.sql (`supabase db push`
-- applies both, in order). Backward compatible: the old app never sends a note on a
-- ready-to-wear line, and a missing note is stored as null.

-- ── 1. A note is part of a ready-to-wear line's identity ─────────────────────────────────────
-- The same size with two different notes is two different instructions, so it must be two
-- lines rather than one line whose quantity swallows the second note. Hashed so a long note
-- (up to 500 characters of Arabic) never approaches the btree entry size limit.
drop index if exists public.cart_items_rtw_key;
create unique index cart_items_rtw_key on public.cart_items
  (cart_id, variant_id, coalesce(length, -1), coalesce(tack_tack, false), md5(coalesce(notes, '')))
  where fulfillment = 'RTW';

-- ── 2. create_order records the note on ready-to-wear lines ──────────────────────────────────
-- Identical to the version in 20260925120000_mto_size_length.sql except for the ready-to-wear
-- INSERT, which now carries the line's note the way the made-to-order one already did.
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
  v_product_id uuid;
  v_color_id   uuid;
  v_mode       text;
  v_qty        integer;
  v_v          record;
  v_p          record;
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
  v_mto_cfg    jsonb;
  v_ship_fee   numeric := 0;
  v_free_thr   numeric := 0;
  v_tax_rate   numeric := 0;
  v_lead_min   integer := null;
  v_lead_max   integer := null;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := coalesce((v_item->>'quantity')::integer, 0);
    v_mode := coalesce(v_item->>'fulfillment', 'RTW');
    if v_qty < 1 then raise exception 'qty'; end if;

    if v_mode = 'MTO' then
      v_product_id := (v_item->>'product_id')::uuid;
      v_color_id   := (v_item->>'color_id')::uuid;
      select * into v_p from products where id = v_product_id;
      -- No FOR UPDATE and no stock test: a made-to-order piece is cut after the sale, so there
      -- is nothing to reserve and nothing to run out of.
      if not found or v_p.fulfillment = 'READY_TO_WEAR' or v_p.mto_price is null then
        raise exception 'mto';
      end if;
      if not exists (select 1 from product_colors where id = v_color_id and product_id = v_product_id) then
        raise exception 'mto';
      end if;
      v_subtotal := v_subtotal + v_p.mto_price * v_qty;
    else
      v_variant_id := (v_item->>'variant_id')::uuid;
      select * into v_v from variants where id = v_variant_id for update;
      if not found or not v_v.available or v_v.stock < v_qty then
        raise exception 'stock';
      end if;
      v_subtotal := v_subtotal + v_v.price * v_qty;
    end if;
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

  -- The house-wide lead time, so a line whose product leaves its own blank still snapshots the
  -- number the customer was actually shown.
  select data into v_mto_cfg from content where key = 'made-to-order';
  if v_mto_cfg is not null then
    v_lead_min := nullif(v_mto_cfg->>'leadMinDays', '')::integer;
    v_lead_max := nullif(v_mto_cfg->>'leadMaxDays', '')::integer;
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
    v_qty  := (v_item->>'quantity')::integer;
    v_mode := coalesce(v_item->>'fulfillment', 'RTW');

    if v_mode = 'MTO' then
      v_product_id := (v_item->>'product_id')::uuid;
      v_color_id   := (v_item->>'color_id')::uuid;
      insert into order_items (order_id, product_id, variant_id, fulfillment, title, color, size,
                               length, tack_tack, measurements, measure_unit, notes,
                               lead_min_days, lead_max_days, sku, price, quantity, image_url)
      select v_order_id, p.id, null, 'MTO', p.title, c.name,
             -- The chosen size and length — what the atelier cuts to. Null only for a line
             -- carried over from the measurement form, which still brings its measurements.
             nullif(v_item->>'size', ''),
             nullif(v_item->>'length', '')::integer,
             coalesce((v_item->>'tack_tack')::boolean, false),
             v_item->'measurements',
             nullif(v_item->>'measure_unit', ''),
             nullif(v_item->>'notes', ''),
             coalesce(p.mto_lead_min, v_lead_min), coalesce(p.mto_lead_max, v_lead_max),
             p.product_code,
             -- Priced from the DB, never from the item payload. Same reason this function
             -- recomputes the subtotal at all.
             p.mto_price, v_qty,
             coalesce(c.image_url, (select url from product_images pi where pi.product_id = p.id order by position limit 1))
      from products p
      join product_colors c on c.id = v_color_id and c.product_id = p.id
      where p.id = v_product_id;
    else
      v_variant_id := (v_item->>'variant_id')::uuid;
      insert into order_items (order_id, product_id, variant_id, fulfillment, title, color, size,
                               length, tack_tack, notes, sku, price, quantity, image_url)
      select v_order_id, p.id, v.id, 'RTW', p.title, v.color, v.size,
             nullif(v_item->>'length', '')::integer, (v_item->>'tack_tack')::boolean,
             nullif(v_item->>'notes', ''),
             v.sku, v.price, v_qty,
             coalesce(v.image_url, (select url from product_images pi where pi.product_id = v.product_id order by position limit 1))
      from variants v join products p on p.id = v.product_id
      where v.id = v_variant_id;
    end if;
  end loop;

  return jsonb_build_object('id', v_order_id, 'subtotal', v_subtotal, 'discount', v_discount, 'shipping', v_shipping, 'tax', v_tax, 'total', v_total);
end;
$$;

grant execute on function public.create_order(text, uuid, jsonb, text, jsonb, text) to service_role;
