-- Dynamic product categories.
-- The category list was previously frozen by a CHECK constraint (ABAYA/JALABIYA/SHEILA/OTHER),
-- so admins couldn't introduce a new category. Drop it: `category` stays free text (default
-- 'ABAYA', still indexed), and the write paths now validate/normalize it in application code
-- (lib/actions/products.ts + lib/categories.ts). Existing rows remain valid unchanged.
alter table public.products drop constraint if exists products_category_check;
