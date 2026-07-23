-- App-level fixed-window rate limiter. Vercel WAF rate limiting needs a Pro plan, so we do it in
-- Postgres (works on any plan). One row per (key, time-window); rate_limit_hit atomically
-- increments the window's counter and returns whether the caller is still within the limit.
-- Callers (lib/rate-limit.ts) fail OPEN, so a limiter error never blocks a real payment.
create table if not exists rate_limits (
  bucket     text primary key,
  count      integer not null default 0,
  expires_at timestamptz not null
);

create or replace function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window bigint  := floor(extract(epoch from now()) / p_window_seconds);
  v_bucket text     := p_key || ':' || v_window;
  v_count  integer;
begin
  -- Opportunistically purge expired buckets so the table stays tiny (no cron needed).
  if random() < 0.02 then
    delete from rate_limits where expires_at < now();
  end if;

  insert into rate_limits (bucket, count, expires_at)
    values (v_bucket, 1, now() + make_interval(secs => p_window_seconds * 2))
    on conflict (bucket) do update set count = rate_limits.count + 1
    returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
