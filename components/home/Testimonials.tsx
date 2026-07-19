import { getTranslations } from "next-intl/server";
import { TESTIMONIALS } from "@/lib/home-content";

/** Card 320px + 24px gap at the widest breakpoint — drives the duration below. */
const CARD_UNIT = 344;
const PIXELS_PER_SECOND = 40;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

/**
 * A server component. An infinite marquee, but the animation is pure CSS — the
 * homepage still ships no JavaScript for this section. The viewport is locked to
 * `dir="ltr"` so the strip travels the same way in Arabic; individual quotes carry
 * `dir="auto"` instead, so the Arabic ones align right inside an LTR strip.
 */
export async function Testimonials() {
  const t = await getTranslations("home");

  // Six testimonials doubled is 4128px of track per half — wider than a 4K viewport,
  // so the -50% loop point never comes into view. The track then repeats that half
  // once more, which is what makes the wrap seamless.
  const half = [...TESTIMONIALS, ...TESTIMONIALS];
  const track = [...half, ...half];
  const speed = Math.round((half.length * CARD_UNIT) / PIXELS_PER_SECOND);

  return (
    <section className="bg-haze py-16">
      <h2 className="section-title">{t("wordsOfLove")}</h2>
      <div className="hairline-gold-center mx-auto mt-5 mb-10 w-24" />

      <div
        dir="ltr"
        className="marquee-viewport no-scrollbar overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <div
          className="marquee-track flex w-max gap-6"
          style={{ animationDuration: `${speed}s` }}
        >
          {track.map((tm, i) => (
            <div
              key={i}
              className="group flex w-[260px] shrink-0 flex-col border border-signal/15 bg-paper p-6 transition-colors duration-500 hover:border-signal/40 sm:w-[320px] sm:p-8"
            >
              <div className="display select-none text-4xl leading-none text-signal/25 transition-colors duration-500 group-hover:text-signal/45">
                &ldquo;
              </div>
              <p
                dir="auto"
                className="mt-2 mb-5 line-clamp-4 flex-1 text-[15px] leading-relaxed text-ink/85"
              >
                {tm.quote}
              </p>

              <div>
                <div className="hairline-gold mb-4" />
                <div className="flex items-center gap-3">
                  <div className="display flex size-10 shrink-0 items-center justify-center border border-signal/30 bg-haze text-xs text-signal/70">
                    {initials(tm.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] uppercase tracking-[0.2em] text-signal">
                      {tm.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-snug tracking-wide text-muted">
                      {tm.location}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
