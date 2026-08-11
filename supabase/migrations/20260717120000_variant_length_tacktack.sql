-- Length + Tack Tack become real variant axes: every (color, size, length, tack_tack)
-- combination is its own stockable row. Existing 447 variants expand to the full matrix
-- (12 lengths × 2 tack-tack = 24 each → 10,728 rows). See generate_variants / adjust_stock_bulk
-- for the RPCs the admin uses to create combinations and set stock in bulk.
--
-- IN-PLACE and ADDITIVE: no variant is ever deleted, so every existing UUID survives and the
-- FKs that cascade off it (cart_items ON DELETE CASCADE, order_items ON DELETE SET NULL) are
-- untouched. A live cart line pointing at an anchor variant keeps working.

-- ── 0. Backup current stock before we touch it ──────────────────────────────
-- IDs are preserved by everything below, so a restore is:
--   update variants v set stock = b.stock, available = b.available
--   from variants_backup_20260717 b where v.id = b.id;
drop table if exists public.variants_backup_20260717;
create table public.variants_backup_20260717 as select * from public.variants;

-- ── 1. New columns ──────────────────────────────────────────────────────────
-- Both NOT NULL: a nullable column in the unique index would be treated as NULLS DISTINCT,
-- so duplicate (product, color, size, NULL, NULL) rows could accumulate unchecked. Defaults
-- keep any legacy single-row insert (seed, a hand-added variant) valid — it lands as the
-- (length 50, no tack-tack) anchor. length = 0 is reserved for "not applicable".
alter table public.variants
  add column if not exists length    integer not null default 50,
  add column if not exists tack_tack boolean not null default false;

alter table public.variants
  add constraint variants_length_check check (length = 0 or length between 30 and 200);

-- ── 2. Widen the uniqueness key ─────────────────────────────────────────────
-- The old inline `unique (product_id, color, size)` is auto-named; drop by discovered name.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.variants'::regclass and contype = 'u'
    and array_length(conkey, 1) = 3;
  if c is not null then execute format('alter table public.variants drop constraint %I', c); end if;
end $$;

alter table public.variants
  add constraint variants_pcslt_key unique (product_id, color, size, length, tack_tack);

-- ── 3. Expand every anchor into the full length × tack-tack matrix ───────────
-- INSERT..SELECT reads the pre-statement snapshot, so the new rows are not re-expanded.
-- The dropped 3-col unique guaranteed one anchor per (product, color, size), so no fan-out.
-- New combinations start unsellable (stock 0); the owner sets real numbers via the admin grid.
insert into public.variants
  (product_id, color, color_hex, size, sku, price, compare_at, stock, available, image_url, position, length, tack_tack)
select a.product_id, a.color, a.color_hex, a.size, null, a.price, a.compare_at,
       0, false, a.image_url, 0, g.len, g.tt
from public.variants a
cross join (
  select len, tt
  from generate_series(50, 61) as len
  cross join (values (false), (true)) as t(tt)
  where not (len = 50 and tt = false)   -- the anchor already exists
) g
where a.length = 50 and a.tack_tack = false
on conflict (product_id, color, size, length, tack_tack) do nothing;

-- ── 4. Zero ALL stock (explicit owner decision) ─────────────────────────────
-- The catalogue reads Sold Out until stock is entered per combination. The 229 real values
-- live in variants_backup_20260717 and are restorable via the query at the top.
update public.variants set stock = 0, available = false;

-- ── 5. Deterministic position ───────────────────────────────────────────────
-- catalog.ts and ProductDetail derive color/size display order from position, which the
-- expansion scrambled. Re-key it: color, then canonical size order, then length, then tack-tack.
with ordered as (
  select id, row_number() over (
    partition by product_id
    order by color,
             coalesce(array_position(array['XS','S','M','L','XL','XXL','One Size'], size), 99),
             length, tack_tack
  ) - 1 as pos
  from public.variants
)
update public.variants v set position = o.pos from ordered o where o.id = v.id;

-- ── 6. order_items carries the chosen options (nullable: historical rows predate them) ──
alter table public.order_items
  add column if not exists length    integer,
  add column if not exists tack_tack boolean;

-- create_order: byte-for-byte the original (20260704120100_rpc.sql) except the two order_items
-- lines, which now also snapshot v.length and v.tack_tack. Signature unchanged → the grant holds.
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

  -- snapshot line items (now including length + tack_tack)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    insert into order_items (order_id, variant_id, title, color, size, length, tack_tack, sku, price, quantity, image_url)
    select v_order_id, v.id, p.title, v.color, v.size, v.length, v.tack_tack, v.sku, v.price, v_qty,
           coalesce(v.image_url, (select url from product_images pi where pi.product_id = v.product_id order by position limit 1))
    from variants v join products p on p.id = v.product_id
    where v.id = v_variant_id;
  end loop;

  return jsonb_build_object('id', v_order_id, 'subtotal', v_subtotal, 'discount', v_discount, 'shipping', v_shipping, 'tax', v_tax, 'total', v_total);
end;
$$;

grant execute on function public.create_order(text, uuid, jsonb, text, jsonb, text) to service_role;

-- ── 7. generate_variants: create the MISSING combinations for a product ──────
-- on conflict do nothing → never touches an existing row's stock/price/sku. Returns the
-- number of rows actually created so the admin can confirm.
create or replace function public.generate_variants(
  p_product_id uuid,
  p_colors     jsonb,        -- [{"name":"Black","hex":"#000000"}, ...]
  p_sizes      text[],
  p_lengths    integer[],
  p_tacktacks  boolean[],
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

  insert into variants (product_id, color, color_hex, size, price, compare_at, stock, available, position, length, tack_tack)
  select p_product_id,
         (c->>'name'), (c->>'hex'),
         s, greatest(coalesce(p_price, 0), 0), null,
         greatest(coalesce(p_stock, 0), 0), (greatest(coalesce(p_stock, 0), 0) > 0),
         0, l, t
  from jsonb_array_elements(p_colors) as c
  cross join unnest(p_sizes)     as s
  cross join unnest(p_lengths)   as l
  cross join unnest(p_tacktacks) as t
  on conflict (product_id, color, size, length, tack_tack) do nothing;

  select count(*) into v_after from variants where product_id = p_product_id;

  -- keep display order and price range coherent
  with ordered as (
    select id, row_number() over (
      partition by product_id
      order by color,
               coalesce(array_position(array['XS','S','M','L','XL','XXL','One Size'], size), 99),
               length, tack_tack
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

grant execute on function public.generate_variants(uuid, jsonb, text[], integer[], boolean[], integer, integer) to service_role;

-- ── 8. adjust_stock_bulk: set stock on many cells in one call ────────────────
-- Loops the adjust_stock contract (absolute set): recomputes `available`, and writes a ledger
-- row only where the value actually changed. Returns the number of cells changed.
create or replace function public.adjust_stock_bulk(
  p_rows        jsonb,        -- [{"id":"uuid","stock":5}, ...]
  p_reason      text default 'correction',
  p_actor_id    uuid default null,
  p_actor_email text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    jsonb;
  v_id     uuid;
  v_set    integer;
  v_cur    integer;
  v_new    integer;
  v_delta  integer;
  v_changed integer := 0;
begin
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_id  := (v_row->>'id')::uuid;
    v_set := greatest(coalesce((v_row->>'stock')::integer, 0), 0);
    select stock into v_cur from variants where id = v_id for update;
    if not found then continue; end if;
    v_new := v_set;
    v_delta := v_new - v_cur;
    if v_delta = 0 then continue; end if;
    update variants set stock = v_new, available = (v_new > 0) where id = v_id;
    insert into inventory_adjustments (variant_id, delta, stock_after, reason, actor_id, actor_email)
      values (v_id, v_delta, v_new, coalesce(p_reason, 'correction'), p_actor_id, p_actor_email);
    v_changed := v_changed + 1;
  end loop;
  return v_changed;
end;
$$;

grant execute on function public.adjust_stock_bulk(jsonb, text, uuid, text) to service_role;

-- ── 9. Scaling RPCs — the storefront collection queries would truncate at 10k rows ──
-- PostgREST caps result rows (default 1000) and truncates silently. These aggregate the
-- variant table down to ≤ (#products) rows so the collection colour facet and colour/in-stock
-- filter stay correct past 1000 variants.
create or replace function public.collection_color_facets(p_ids uuid[])
returns table(color text, hex text, product_count bigint)
language sql stable
security definer
set search_path = public
as $$
  select v.color, min(v.color_hex) as hex, count(distinct v.product_id) as product_count
  from variants v
  join products p on p.id = v.product_id and p.status = 'active'
  where p_ids is null or v.product_id = any(p_ids)
  group by v.color
  order by product_count desc, v.color;
$$;

grant execute on function public.collection_color_facets(uuid[]) to service_role;

create or replace function public.variant_product_ids(p_color text, p_in_stock boolean)
returns setof uuid
language sql stable
security definer
set search_path = public
as $$
  select distinct v.product_id
  from variants v
  where (p_color is null or v.color = p_color)
    and (not coalesce(p_in_stock, false) or (v.available and v.stock > 0));
$$;

grant execute on function public.variant_product_ids(text, boolean) to service_role;
