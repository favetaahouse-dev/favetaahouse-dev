import Image from "next/image";

export function PageHero({
  image,
  title,
  subtitle,
}: {
  image: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="relative flex h-[46vh] min-h-[320px] items-center justify-center overflow-hidden">
      <Image src={image} alt="" fill priority className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative px-6 text-center text-white">
        <h1 className="display text-[clamp(2rem,5vw,3.25rem)]" style={{ color: "#fff" }}>
          {title}
        </h1>
        {subtitle && <p className="mt-3.5 text-sm font-light tracking-[0.1em] text-white/85">{subtitle}</p>}
      </div>
    </section>
  );
}
