import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductsByCategory } from "@/lib/data/catalog";
import { getHomeMedia, getHomeSectionTitles } from "@/lib/content";
import {
  LEGACY_CATEGORY_HANDLES,
  categoryHandle,
  categoryLabelFallback,
  sortCategoriesForNav,
} from "@/lib/categories";
import { Hero } from "@/components/home/Hero";
import { TrendyTabs, type TrendyTab } from "@/components/home/TrendyTabs";
import { StoryBand } from "@/components/home/StoryBand";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Independent cached reads ("products" / "content"), so they resolve together rather
  // than in series.
  const [groups, heroMedia, titles, tn] = await Promise.all([
    getProductsByCategory(60, locale),
    getHomeMedia(),
    getHomeSectionTitles(locale),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  // Labels and order are resolved here, on the server, so the client tab strip needs no
  // i18n lookup of its own — the same arrangement getNavItems uses for the header, and
  // the same ordering rule, so the tabs and the nav can never disagree.
  const byCategory = new Map(groups.map((g) => [g.category, g.products]));
  const tabs: TrendyTab[] = sortCategoriesForNav([...byCategory.keys()])
    .map((category) => {
      const handle = categoryHandle(category);
      const legacyKey = LEGACY_CATEGORY_HANDLES[category];
      return {
        handle,
        href: `/collections/${handle}`,
        label: legacyKey ? tn(legacyKey) : categoryLabelFallback(category),
        products: byCategory.get(category) ?? [],
      };
    })
    .filter((tab) => tab.products.length > 0);

  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <>
      <Hero media={heroMedia} />
      <TrendyTabs tabs={tabs} title={titles.trendy || t("trendy")} />
      <StoryBand />
    </>
  );
}
