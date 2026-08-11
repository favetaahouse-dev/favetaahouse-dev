-- FAVETAA commerce schema (relational). snake_case columns, text+CHECK enums.
-- RLS enabled with no policies => only the service_role (server) can read/write.

create extension if not exists pgcrypto;

-- ── updated_at trigger helper ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── users (customers + admins; NextAuth credentials) ────────
create table public.users (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  name           text,
  password       text,
  role           text not null default 'CUSTOMER' check (role in ('CUSTOMER','ADMIN')),
  image          text,
  email_verified timestamptz,
  created_at     timestamptz not null default now()
);

-- ── products ────────────────────────────────────────────────
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  handle         text unique not null,
  title          text not null,
  title_ar       text,
  description    text,
  description_ar text,
  product_code   text,
  materials      text,
  materials_ar   text,
  model_size     text,
  details        text,
  details_ar     text,
  packaging      text,
  category       text not null default 'ABAYA' check (category in ('ABAYA','JALABIYA','SHEILA','OTHER')),
  vendor         text not null default 'FAVETAA',
  featured       boolean not null default false,
  on_sale        boolean not null default false,
  price_min      integer not null default 0,
  price_max      integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index products_category_sale_price_idx on public.products (category, on_sale, price_min);
create index products_featured_idx on public.products (featured);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ── variants ────────────────────────────────────────────────
create table public.variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  shopify_id text,
  color      text not null,
  color_hex  text,
  size       text not null,
  sku        text,
  price      integer not null,
  compare_at integer,
  stock      integer not null default 0,
  available  boolean not null default true,
  image_url  text,
  position   integer not null default 0,
  unique (product_id, color, size)
);
create index variants_product_idx on public.variants (product_id);

-- ── product_images ──────────────────────────────────────────
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt        text,
  position   integer not null default 0,
  color_key  text
);
create index product_images_product_idx on public.product_images (product_id);

-- ── collections ─────────────────────────────────────────────
create table public.collections (
  id       uuid primary key default gen_random_uuid(),
  handle   text unique not null,
  title    text not null,
  title_ar text,
  kind     text not null default 'FEATURE' check (kind in ('CATEGORY','SEASONAL','FEATURE','SALE')),
  position integer not null default 0
);

create table public.product_collections (
  product_id    uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  position      integer not null default 0,
  primary key (product_id, collection_id)
);
create index product_collections_collection_idx on public.product_collections (collection_id);

-- ── addresses ───────────────────────────────────────────────
create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  full_name  text not null,
  line1      text not null,
  line2      text,
  city       text not null,
  country    text not null default 'Qatar',
  phone      text,
  is_default boolean not null default false
);

-- ── carts + items ───────────────────────────────────────────
create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references public.users(id) on delete cascade,
  currency    text not null default 'QAR',
  coupon_code text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  quantity   integer not null default 1,
  unique (cart_id, variant_id)
);

-- ── orders + items ──────────────────────────────────────────
create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  number                bigint generated always as identity,
  user_id               uuid references public.users(id) on delete set null,
  email                 text not null,
  status                text not null default 'PENDING' check (status in ('PENDING','PAID','FULFILLED','CANCELLED','REFUNDED')),
  currency              text not null default 'QAR',
  subtotal              integer not null,
  discount              integer not null default 0,
  shipping              integer not null default 0,
  tax                   integer not null default 0,
  total                 integer not null,
  coupon_code           text,
  payment_provider      text check (payment_provider in ('skipcash','demo','manual')),
  payment_ref           text,
  paid_at               timestamptz,
  tracking_number       text,
  shipping_address      jsonb,
  created_at            timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete set null,
  title      text not null,
  color      text not null,
  size       text not null,
  sku        text,
  price      integer not null,
  quantity   integer not null,
  image_url  text
);
create index order_items_order_idx on public.order_items (order_id);

-- ── payments (gateway audit trail + webhook idempotency) ────
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  cart_id             text,
  provider            text not null,          -- 'skipcash' | 'demo' | 'manual'
  provider_payment_id text unique,            -- SkipCash resultObj.id (idempotency key)
  uid                 text,                   -- our generated Uid sent to SkipCash
  transaction_id      text,                   -- our TransactionId (= order id)
  amount              integer not null,       -- QAR minor units
  currency            text not null default 'QAR',
  status              text not null default 'new' check (status in ('new','paid','failed','cancelled')),
  status_id           integer,                -- SkipCash statusId (2 = paid)
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ── wishlist ────────────────────────────────────────────────
create table public.wishlist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unique (user_id, product_id)
);

-- ── coupons ─────────────────────────────────────────────────
create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  type        text not null default 'PERCENT' check (type in ('PERCENT','FIXED')),
  value       integer not null,          -- PERCENT: 0-100 ; FIXED: cents (QAR)
  min_spend   integer not null default 0,-- cents
  starts_at   timestamptz,
  expires_at  timestamptz,
  usage_limit integer,
  used_count  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── CMS content (JSONB documents, ryzo convention) ──────────
create table public.content (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger content_updated_at before update on public.content
  for each row execute function public.set_updated_at();

-- ── RLS: deny-all to anon/authenticated; service_role bypasses ─
alter table public.users               enable row level security;
alter table public.products            enable row level security;
alter table public.variants            enable row level security;
alter table public.product_images      enable row level security;
alter table public.collections         enable row level security;
alter table public.product_collections enable row level security;
alter table public.addresses           enable row level security;
alter table public.carts               enable row level security;
alter table public.cart_items          enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.payments            enable row level security;
alter table public.wishlist_items      enable row level security;
alter table public.coupons             enable row level security;
alter table public.content             enable row level security;

-- ── grant table access to the server role (service_role has BYPASSRLS) ──
-- anon/authenticated get no grants + RLS deny-all => browser cannot touch tables.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
