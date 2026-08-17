-- Made-to-order becomes the house's primary offering; ready-to-wear continues alongside it.
--
-- A made-to-order piece has no standard size — the customer submits measurements — and it
-- carries its own price, independent of the per-size ready-to-wear prices. That breaks the
-- one assumption the schema was built on: that every purchasable thing IS a variant row.
--
-- Colour is the axis both modes share, and today it exists only as text repeated across the
-- (colour, size) variant rows. So colour moves into its own table and a line — in the cart or
-- on an order — becomes (product, colour, fulfilment) with EITHER a variant (ready-to-wear,
-- stocked, sized) OR a measurement set (made-to-order, unstocked, unsized).
--
-- The alternative was to keep colour on variants and have made-to-order lines anchor to some
-- arbitrary row of the chosen colour. Rejected: it forces a made-to-order-only product — soon
-- most of the catalogue — to carry dummy size rows whose stock number means nothing, it breaks
-- when that anchor row is deleted, and cart_items.variant_id has to go nullable anyway the
-- moment a line can exist without a size.

-- ── 1. product_colors: the canonical colour list ────────────────────────────
create table public.product_colors (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,
  name_ar    text,
  hex        text,
  image_url  text,
  position   integer not null default 0,
  unique (product_id, name)
);
create index product_colors_product_idx on public.product_colors (product_id);

-- Backfilled from the variant grid: variants is unique on (product_id, color, size), so the
-- distinct (product_id, color) pairs are exactly the colours in use. min(position) keeps the
-- swatches in the order the storefront already shows them (not contiguous, but ordering is
-- all position is read for).
insert into public.product_colors (product_id, name, hex, position)
select v.product_id, v.color, max(v.color_hex), min(v.position)
from public.variants v
group by v.product_id, v.color;

alter table public.variants
  add column if not exists color_id uuid references public.product_colors(id) on delete cascade;
update public.variants v
   set color_id = c.id
  from public.product_colors c
 where c.product_id = v.product_id and c.name = v.color;
alter table public.variants alter column color_id set not null;
create index variants_color_idx on public.variants (color_id);

-- variants.color / color_hex are KEPT as a denormalised snapshot rather than dropped: the
-- colour facet RPCs (variant_product_ids, collection_color_facets) filter on the text, and
-- order_items snapshots read it. The admin dual-writes both on rename — see
-- lib/actions/products.ts setProductColors.

-- ── 2. products: fulfilment mode, made-to-order price, lead time ────────────
-- The default is set in TWO STEPS on purpose. `add column ... default X` backfills every
-- existing row with X, so declaring MADE_TO_ORDER here would convert the entire live
-- catalogue — every one of them ready-to-wear, none of them carrying an mto_price — in a
-- single statement. Adding it as READY_TO_WEAR is what every existing product already IS,
-- which makes this a behavioural no-op for them; the default then moves for rows created
-- from here on, which are made-to-order unless the owner says otherwise.
alter table public.products
  add column if not exists fulfillment text not null default 'READY_TO_WEAR'
    check (fulfillment in ('READY_TO_WEAR','MADE_TO_ORDER','BOTH')),
  add column if not exists mto_price      integer,
  add column if not exists mto_compare_at integer,
  -- null = fall back to the global default in content key 'made-to-order'
  add column if not exists mto_lead_min   integer,
  add column if not exists mto_lead_max   integer,
  -- which measurement fields apply to this product; empty = every field in the CMS list
  add column if not exists mto_fields     text[] not null default '{}';

alter table public.products alter column fulfillment set default 'MADE_TO_ORDER';

create index products_fulfillment_idx on public.products (fulfillment);

-- Deliberately NO check constraint tying mto_price to the mode. duplicateProduct copies whole
-- rows and bulkProductAction updates many at once; a constraint here turns an owner's
-- half-finished draft into a failed write. The rule is enforced in zod on the way in, and the
-- read layer treats "made-to-order mode with a null price" as simply not offering it.

-- ── 3. cart_items: a line is (product, colour, fulfilment) ──────────────────
alter table public.cart_items
  add column if not exists product_id   uuid references public.products(id) on delete cascade,
  add column if not exists color_id     uuid references public.product_colors(id) on delete cascade,
  add column if not exists fulfillment  text not null default 'RTW' check (fulfillment in ('RTW','MTO')),
  add column if not exists measurements jsonb,
  add column if not exists measure_unit text check (measure_unit in ('cm','in')),
  add column if not exists notes        text;

update public.cart_items ci
   set product_id = v.product_id, color_id = v.color_id
  from public.variants v
 where v.id = ci.variant_id;

alter table public.cart_items alter column product_id set not null;
alter table public.cart_items alter column variant_id drop not null;

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.cart_items'::regclass and contype = 'u';
  if c is not null then execute format('alter table public.cart_items drop constraint %I', c); end if;
end $$;

-- Ready-to-wear only, and over coalesced expressions. Both halves matter: made-to-order lines
-- must never collapse into each other (two customers' measurements are two garments), and the
-- constraint this replaces silently never deduped at all when length was NULL, because Postgres
-- treats NULLs as distinct — so "add 56-inch, add 56-inch" wrote two rows.
create unique index cart_items_rtw_key on public.cart_items
  (cart_id, variant_id, coalesce(length, -1), coalesce(tack_tack, false))
  where fulfillment = 'RTW';
create index cart_items_cart_idx on public.cart_items (cart_id);

-- ── 4. order_items: snapshot the measurements AND the promised lead time ────
alter table public.order_items
  add column if not exists product_id    uuid references public.products(id) on delete set null,
  add column if not exists fulfillment   text not null default 'RTW' check (fulfillment in ('RTW','MTO')),
  add column if not exists measurements  jsonb,
  add column if not exists measure_unit  text,
  add column if not exists notes         text,
  add column if not exists lead_min_days integer,
  add column if not exists lead_max_days integer;

-- A made-to-order line has no size. size was NOT NULL because every line used to be a variant.
alter table public.order_items alter column size drop not null;

update public.order_items oi
   set product_id = v.product_id
  from public.variants v
 where v.id = oi.variant_id;

-- product_id earns its place beyond display: getOrderItemHandles (lib/data/orders.ts) resolves
-- the Meta Purchase content_ids through variant_id, which made-to-order lines do not have.

-- ── 5. One definition of the product price range ────────────────────────────
-- price_min / price_max feed every collection card, the sort, the filter and the price_range
-- RPC. With two price sources there are now three cases, and having them written out twice
-- (once in SQL for generate_variants, once in TS for recomputePrices) is how they drift.
--
-- It also retires the two-ordered-queries dance in lib/data/product-pricing.ts: that shape
-- exists only to dodge PostgREST's silent 1000-row truncation, which an aggregate cannot hit.
create or replace function public.recompute_product_prices(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_mto  integer;
  v_lo   integer;
  v_hi   integer;
begin
  select fulfillment, mto_price into v_mode, v_mto from products where id = p_product_id;
  if not found then return; end if;

  select min(price), max(price) into v_lo, v_hi from variants where product_id = p_product_id;

  if v_mode = 'MADE_TO_ORDER' then
    v_lo := v_mto;
    v_hi := v_mto;
  elsif v_mode = 'BOTH' and v_mto is not null then
    v_lo := least(coalesce(v_lo, v_mto), v_mto);
    v_hi := greatest(coalesce(v_hi, v_mto), v_mto);
  end if;

  -- No variants and no made-to-order price is a real state (the last colour was just deleted).
  -- Zero the range rather than leaving the price of a product that no longer has one.
  update products
     set price_min = coalesce(v_lo, 0), price_max = coalesce(v_hi, 0)
   where id = p_product_id;
end;
$$;

grant execute on function public.recompute_product_prices(uuid) to service_role;

-- ── 6. create_order: price and validate each line by its fulfilment ─────────
-- The SIGNATURE IS UNCHANGED on purpose. A new parameter means a new grant execute on a new
-- signature, and the old overload keeps resolving until it is explicitly dropped — the trap
-- 20260806120000_meta_attribution.sql went out of its way to avoid. Everything a made-to-order
-- line needs rides inside the p_items jsonb, which createCheckout builds from the DB cart, not
-- from the browser.
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
      select v_order_id, p.id, null, 'MTO', p.title, c.name, null,
             null, coalesce((v_item->>'tack_tack')::boolean, false),
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
                               length, tack_tack, sku, price, quantity, image_url)
      select v_order_id, p.id, v.id, 'RTW', p.title, v.color, v.size,
             nullif(v_item->>'length', '')::integer, (v_item->>'tack_tack')::boolean,
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

-- ── 7. generate_variants: colours come from product_colors now ──────────────
drop function if exists public.generate_variants(uuid, jsonb, text[], integer, integer);

create or replace function public.generate_variants(
  p_product_id uuid,
  p_color_ids  uuid[],
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

  insert into variants (product_id, color_id, color, color_hex, size, price, compare_at, stock, available, position)
  select p_product_id, c.id, c.name, c.hex, s,
         greatest(coalesce(p_price, 0), 0), null,
         greatest(coalesce(p_stock, 0), 0), (greatest(coalesce(p_stock, 0), 0) > 0), 0
  from product_colors c
  cross join unnest(p_sizes) as s
  where c.product_id = p_product_id and c.id = any(p_color_ids)
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

  perform recompute_product_prices(p_product_id);

  return v_after - v_before;
end;
$$;

grant execute on function public.generate_variants(uuid, uuid[], text[], integer, integer) to service_role;

-- ── 8. The colour facets read product_colors, not variants ──────────────────
-- Both of these walked the variant grid, which is now the wrong place to look: a
-- made-to-order-only product has colours and no variants, so it would silently vanish from
-- the colour filter on every collection page. Signatures unchanged, so the grants hold.
--
-- collection_color_facets also loses its min(color_hex) hedge — that existed only because the
-- hex was duplicated across every size row of a colour and could drift. There is one row now.
create or replace function public.collection_color_facets(p_ids uuid[])
returns table(color text, hex text, product_count bigint)
language sql stable
security definer
set search_path = public
as $$
  select pc.name, min(pc.hex) as hex, count(distinct pc.product_id) as product_count
  from product_colors pc
  join products p on p.id = pc.product_id and p.status = 'active'
  where p_ids is null or pc.product_id = any(p_ids)
  group by pc.name
  order by product_count desc, pc.name;
$$;

-- The name is a slight misnomer now that colours are not a variant concept, but renaming it
-- means a new signature, a new grant and a call-site change in lib/data/collections.ts for no
-- behavioural gain.
create or replace function public.variant_product_ids(p_color text, p_in_stock boolean)
returns setof uuid
language sql stable
security definer
set search_path = public
as $$
  select distinct pc.product_id
  from product_colors pc
  join products p on p.id = pc.product_id
  where (p_color is null or pc.name = p_color)
    and (
      not coalesce(p_in_stock, false)
      -- A made-to-order piece is cut after the sale, so it is never out of stock. Without
      -- this the "in stock only" filter would hide the entire made-to-order catalogue.
      or p.fulfillment <> 'READY_TO_WEAR'
      or exists (
        select 1 from variants v
         where v.product_id = pc.product_id and v.available and v.stock > 0
      )
    );
$$;

-- ── 9. Fold the new price rule over the existing catalogue ──────────────────
-- A no-op today (everything is READY_TO_WEAR, so the rule reduces to min/max over variants),
-- but it proves the function against real data at migration time rather than at the first
-- admin save.
select public.recompute_product_prices(id) from public.products;
