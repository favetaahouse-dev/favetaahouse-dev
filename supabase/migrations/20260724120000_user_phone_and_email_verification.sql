-- Customer accounts now capture a phone number and must verify their email via a 6-digit
-- code before they can log in. Phone is stored only (no SMS verification). The existing
-- users.email_verified column (previously unused) becomes the "verified" flag.

alter table public.users add column if not exists phone text;

-- Backfill: every existing account (customers + the seeded admin/staff) is treated as
-- already-verified so the new login gate can't lock anyone out. Only accounts created
-- AFTER this migration go through verification.
update public.users set email_verified = now() where email_verified is null;

-- One row per issued code. We store a bcrypt hash of the code, never the plaintext.
-- Codes expire (expires_at), are single-use (consumed_at), and cap failed tries (attempts).
create table if not exists public.email_verification_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists email_verification_codes_email_idx
  on public.email_verification_codes (email, created_at desc);

-- Deny-all RLS: only the server-side service-role client (which bypasses RLS) ever
-- reads or writes this table, matching every other table in this schema.
alter table public.email_verification_codes enable row level security;
