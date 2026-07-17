import { setRequestLocale } from "next-intl/server";
import { getFeaturedProducts } from "@/lib/data/catalog";
import { getHomeMedia } from "@/lib/content";
import { VideoHero } from "@/components/home/VideoHero";
import {
  ShopSaleButton,
  TravelCollage,
  TravelIntro,
  WhyUs,
  InstagramGallery,
} from "@/components/home/SimpleSections";
import { FeaturedCarousel } from "@/components/home/FeaturedCarousel";
import { CampaignVideo } from "@/components/home/CampaignVideo";
import { Testimonials } from "@/components/home/Testimonials";
import { Newsletter } from "@/components/home/Newsletter";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [featured, media] = await Promise.all([getFeaturedProducts(20), getHomeMedia()]);

  return (
    <>
      <VideoHero src={media.heroVideo} />
      <ShopSaleButton />
      <FeaturedCarousel products={featured} />
      <TravelCollage />
      <TravelIntro />
      <CampaignVideo src={media.campaignVideo} />
      <WhyUs />
      <Testimonials />
      <InstagramGallery />
      <Newsletter />
    </>
  );
}
