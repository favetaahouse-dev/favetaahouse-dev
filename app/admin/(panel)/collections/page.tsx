import Link from "next/link";
import { supabase } from "@/lib/supabase";

const KIND_STYLE: Record<string, string> = {
  CATEGORY: "text-gold",
  SALE: "text-red-400",
  SEASONAL: "text-white/60",
  FEATURE: "text-white/60",
};

export default async function AdminCollections() {
  const { data: collections } = await supabase
    .from("collections")
    .select("id, handle, title, kind, position")
    .order("position", { ascending: true });

  return (
    <div className="border border-white/10 bg-[#222320]">
      <div className="border-b border-white/10 px-5 py-3">
        <h2 className="font-button text-xs uppercase tracking-[0.16em]">Collections ({(collections ?? []).length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
              <th className="px-5 py-3 text-start">Title</th>
              <th className="px-3 py-3 text-start">Handle</th>
              <th className="px-3 py-3 text-start">Kind</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(collections ?? []).map((c) => (
              <tr key={c.id as string} className="border-b border-white/5">
                <td className="px-5 py-3">{c.title as string}</td>
                <td className="px-3 py-3 text-white/50">{c.handle as string}</td>
                <td className={`px-3 py-3 text-[11px] uppercase tracking-wider ${KIND_STYLE[c.kind as string] ?? "text-white/60"}`}>
                  {c.kind as string}
                </td>
                <td className="px-3 py-3">
                  <Link href={`/collections/${c.handle}`} target="_blank" className="text-xs text-gold hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-white/40">
        Category & Sale collections are computed from product data. Seasonal/Feature collections can be curated by
        assigning products (coming soon).
      </p>
    </div>
  );
}
