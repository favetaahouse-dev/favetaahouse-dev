import { requirePageAccess } from "@/lib/admin-guard";

/** page.tsx here is a Client Component, so the guard lives in this server layout. */
export default async function CouponsLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("coupons:read");
  return children;
}
