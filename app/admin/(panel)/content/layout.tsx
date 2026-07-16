import { requirePageAccess } from "@/lib/admin-guard";

/** [section]/page.tsx here is a Client Component, so the guard lives in this server layout. */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("content:read");
  return children;
}
