import type { MetadataRoute } from "next";
import { getAllProductHandles } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const handles = await getAllProductHandles();

  const paths = [
    "",
    "/collections/all",
    "/collections/abayas",
    "/collections/jalabiyas",
    "/collections/sales",
    "/collections/travel-collection",
    "/pages/about-us",
    "/pages/materials-colors",
    "/pages/contact",
    "/pages/collaborations",
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
