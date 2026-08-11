-- Aggregate order analytics in the database (SUM/COUNT/GROUP BY) so the admin dashboard is not
-- computed from a PostgREST-truncated 1000-row slice (config.toml db.max_rows = 1000), which
-- would silently understate revenue / order counts / best-sellers once the store passes 1000
-- orders (or paid order_items). Returns jsonb consumed by lib/data/admin-analytics.ts.
create or replace function public.admin_order_analytics(p_days integer)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with paid as (
    select total, created_at from orders where status in ('PAID', 'FULFILLED')
  ),
  by_day as (
    select to_char(created_at, 'YYYY-MM-DD') as d,
           sum(total)::bigint as rev, count(*)::int as ord
    from paid
    where created_at >= now() - make_interval(days => greatest(p_days, 1))
    group by 1
  ),
  by_status as (
    select status, count(*)::int as c from orders group by status
  ),
  best as (
    select oi.title, sum(oi.quantity)::int as units, sum(oi.price * oi.quantity)::bigint as rev
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.status in ('PAID', 'FULFILLED')
    group by oi.title
    order by units desc
    limit 10
  )
  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from paid), 0),
    'paidOrders', (select count(*) from paid),
    'totalOrders', (select count(*) from orders),
    'revenueByDay', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'revenue', rev, 'orders', ord) order by d) from by_day), '[]'::jsonb),
    'ordersByStatus', coalesce((select jsonb_agg(jsonb_build_object('name', status, 'value', c)) from by_status), '[]'::jsonb),
    'bestSellers', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'units', units, 'revenue', rev)) from best), '[]'::jsonb)
  );
$$;

grant execute on function public.admin_order_analytics(integer) to service_role;
