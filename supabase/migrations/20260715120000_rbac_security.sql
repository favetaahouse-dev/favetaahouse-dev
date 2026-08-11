-- Admin platform foundation: granular RBAC, audit log, login history, and admin
-- notifications. Follows the commerce schema conventions: snake_case, text+CHECK
-- enums, uuid PKs (gen_random_uuid), RLS enabled with NO policies so only the
-- service_role (server) can read/write. New tables auto-inherit service_role
-- grants via the default privileges set in the commerce migration.

-- ── roles (built-in + custom) ───────────────────────────────
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  is_system   boolean not null default false,   -- built-in roles cannot be deleted
  rank        integer not null default 0,        -- higher = more privileged
  created_at  timestamptz not null default now()
);

-- ── role_permissions (granular grants; permission catalog lives in code) ──
create table public.role_permissions (
  role_id    uuid not null references public.roles(id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);
create index role_permissions_role_idx on public.role_permissions (role_id);

-- ── users: attach a staff role (null => customer) ───────────
alter table public.users
  add column role_id uuid references public.roles(id) on delete set null;
create index users_role_id_idx on public.users (role_id);

-- ── audit_logs (admin activity trail) ───────────────────────
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.users(id) on delete set null,
  actor_email   text,
  action        text not null,
  resource_type text,
  resource_id   text,
  summary       text,
  metadata      jsonb not null default '{}'::jsonb,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index audit_logs_created_idx  on public.audit_logs (created_at desc);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);
create index audit_logs_actor_idx    on public.audit_logs (actor_id);

-- ── login_events (login history) ────────────────────────────
create table public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete set null,
  email      text,
  success    boolean not null default false,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index login_events_user_idx    on public.login_events (user_id, created_at desc);
create index login_events_created_idx on public.login_events (created_at desc);

-- ── notifications (admin notification center) ───────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  audience   text not null default 'admins' check (audience in ('admins','user')),
  user_id    uuid references public.users(id) on delete cascade,
  type       text not null default 'system',
  title      text not null,
  body       text,
  link       text,
  level      text not null default 'info' check (level in ('info','success','warning','error')),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_feed_idx on public.notifications (audience, created_at desc);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ── RLS: deny-all to anon/authenticated; service_role bypasses ─
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.login_events     enable row level security;
alter table public.notifications    enable row level security;

-- ── seed built-in roles (permission grants seeded from lib/rbac/permissions.ts
--    via `npm run seed`; super_admin also bypasses checks in code) ──
insert into public.roles (key, name, description, is_system, rank) values
  ('super_admin', 'Super Admin', 'Full unrestricted access, including roles & permissions.', true, 100),
  ('admin',       'Admin',       'Full access except role & permission management.',          true, 80),
  ('manager',     'Manager',     'Manage catalog, orders, inventory, customers, marketing.',  true, 60),
  ('staff',       'Staff',       'Day-to-day order and inventory operations.',                true, 40),
  ('read_only',   'Read Only',   'View dashboards and lists; no changes.',                    true, 20)
on conflict (key) do nothing;
