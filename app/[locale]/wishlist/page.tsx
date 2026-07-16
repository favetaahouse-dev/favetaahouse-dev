import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { WishlistView } from "@/components/wishlist/WishlistView";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WishlistView />;
}
