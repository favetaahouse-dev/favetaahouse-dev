import { Link } from "@/lib/i18n-navigation";

export function VideoHero({ src = "/assets/video/hero.mp4" }: { src?: string }) {
  return (
    <Link
      href="/collections/sales"
      className="relative block h-[82vh] w-full overflow-hidden md:h-[94vh]"
      aria-label="Shop the sale"
    >
      <video
        key={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={src}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/15" />
    </Link>
  );
}
