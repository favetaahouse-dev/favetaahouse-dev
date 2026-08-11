-- Rebrand: retire the previous project's name from live data.
--
-- The storefront was built from a scrape of a different store, which reached this schema as
-- the literal vendor string. The base migration's default has been corrected in place (so a
-- fresh `db reset` is clean), but an already-provisioned database still carries the old
-- default and the old rows — this migration converges those.
--
-- Idempotent: re-running it is a no-op once the rows are already FAVETAA.

alter table public.products alter column vendor set default 'FAVETAA';

update public.products
   set vendor = 'FAVETAA'
 where vendor is distinct from 'FAVETAA';

-- The admin and demo accounts seeded under the old brand. The owner account
-- (favetaahouse@gmail.com) is untouched — it holds its own password and is the only actor in
-- the audit log, so dropping these two cannot lock anyone out of /admin. .env.local no longer
-- names them either, so `npm run seed` cannot recreate them.
--
-- orders.user_id is ON DELETE SET NULL, so any order either placed survives with its own email
-- column intact; the cart and wishlist rows cascade.
--
-- Deliberately scoped by exact address rather than a LIKE pattern, so a real customer who
-- happens to have a similar address can never be caught by it.
delete from public.users where email in ('alessia@abaya', 'demo@alessiaabaya.com');
