import type { MetadataRoute } from "next";
import { getAllProductHandles } from "@/lib/data/catalog";
import { HOUSE_CATEGORIES, NEW_IN } from "@/lib/categories";

// getAllProductHandles carries its own "use cache" + "products" tag, so the sitemap
// rebuilds when the catalogue changes rather than re-querying on every crawl.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const handles = await getAllProductHandles();

  const paths = [
    "",
    "/collections/all",
    // The nav's Collections list, from the same definitions the nav is built from.
    ...[NEW_IN.handle, ...HOUSE_CATEGORIES.map((c) => c.handle)].map((h) => `/collections/${h}`),
    "/collections/sales",
    "/collections/travel-collection",
    "/pages/about",
    "/pages/terms-and-conditions",
    "/pages/privacy-policy",
    ...handles.map((h) => `/products/${h}`),
  ];

  const urls: MetadataRoute.Sitemap = [];
  for (const p of paths) {
    urls.push({ url: `${base}${p || "/"}`, changeFrequency: "weekly" }); // English (unprefixed)
    urls.push({ url: `${base}/ar${p}`, changeFrequency: "weekly" }); // Arabic
  }
  return urls;
}
