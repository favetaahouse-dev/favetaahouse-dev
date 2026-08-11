import { requirePageAccess } from "@/lib/admin-guard";

/** page.tsx here is a Client Component, so the guard lives in this server layout. */
export default async function AnnouncementsLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("content:write");
  return children;
}
