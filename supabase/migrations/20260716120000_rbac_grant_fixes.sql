-- Realign live role_permissions with lib/rbac/permissions.ts.
--
-- Surgical on purpose: `npm run seed` rewrites EVERY grant for EVERY role from the
-- DEFAULT_ROLE_PERMISSIONS template, which would destroy anything edited in
-- Admin → Settings → Staff & Roles. This only touches the rows that changed.

-- 1. `reviews:read` / `reviews:moderate` are gone from the catalog: no reviews table
--    ever existed and /admin/reviews was a hardcoded empty state. role_permissions.permission
--    is bare text with no FK, so these would otherwise linger as dead rows forever.
delete from public.role_permissions
where permission in ('reviews:read', 'reviews:moderate');

-- 2. read_only was defined as "every permission ending in :read", which quietly handed it
--    customers:read (the full customer PII CSV export at /api/admin/export/customers) and
--    audit:read (the security log). Read-only should mean operational data.
delete from public.role_permissions
where role_id = (select id from public.roles where key = 'read_only')
  and permission in ('customers:read', 'audit:read');

-- 3. staff work orders, not the customer list; the bulk PII export is not theirs either.
delete from public.role_permissions
where role_id = (select id from public.roles where key = 'staff')
  and permission = 'customers:read';

-- 4. Marking the notification bell read is a write, and markNotificationsRead() with no
--    ids clears the whole team's inbox — so PATCH /api/admin/notifications now requires
--    notifications:write. staff legitimately use the bell, so grant it.
insert into public.role_permissions (role_id, permission)
select id, 'notifications:write' from public.roles where key = 'staff'
on conflict (role_id, permission) do nothing;
