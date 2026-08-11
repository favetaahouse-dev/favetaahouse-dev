-- Catalog & inventory: product lifecycle (status + tags), an inventory-adjustment
-- ledger, and an atomic adjust_stock RPC for manual stock control.

alter table public.products
  add column status text not null default 'active' check (status in ('active','draft','archived')),
  add column tags   text[] not null default '{}';
create index products_status_idx on public.products (status);
create index products_tags_idx   on public.products using gin (tags);

-- ── inventory_adjustments (every stock change, manual or automatic) ──
create table public.inventory_adjustments (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references public.variants(id) on delete cascade,
  delta       integer not null,                 -- signed change applied
  stock_after integer not null,                 -- resulting stock level
  reason      text not null default 'manual'
              check (reason in ('manual','restock','correction','damage','return','sale','refund')),
  note        text,
  order_id    uuid references public.orders(id) on delete set null,
  actor_id    uuid references public.users(id) on delete set null,
  actor_email text,
  created_at  timestamptz not null default now()
);
create index inventory_adjustments_variant_idx on public.inventory_adjustments (variant_id, created_at desc);
create index inventory_adjustments_created_idx on public.inventory_adjustments (created_at desc);

alter table public.inventory_adjustments enable row level security;

-- adjust_stock: atomically change a variant's stock by p_delta (or to an absolute
-- level when p_set is provided), write a ledger row, recompute `available`, and
-- return the new stock. Stock is floored at 0.
create or replace function public.adjust_stock(
  p_variant_id  uuid,
  p_delta       integer,
  p_reason      text default 'manual',
  p_note        text default null,
  p_actor_id    uuid default null,
  p_actor_email text default null,
  p_set         integer default null,
  p_order_id    uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_new   integer;
  v_delta integer;
begin
  select stock into v_stock from variants where id = p_variant_id for update;
  if not found then raise exception 'variant not found'; end if;
  if p_set is not null then
    v_new := greatest(p_set, 0);
    v_delta := v_new - v_stock;
  else
    v_delta := coalesce(p_delta, 0);
    v_new := greatest(v_stock + v_delta, 0);
  end if;
  update variants set stock = v_new, available = (v_new > 0) where id = p_variant_id;
  insert into inventory_adjustments (variant_id, delta, stock_after, reason, note, order_id, actor_id, actor_email)
    values (p_variant_id, v_delta, v_new, coalesce(p_reason, 'manual'), p_note, p_order_id, p_actor_id, p_actor_email);
  return v_new;
end;
$$;

grant execute on function public.adjust_stock(uuid, integer, text, text, uuid, text, integer, uuid) to service_role;
