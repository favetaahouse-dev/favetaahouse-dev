import { Link } from "@/lib/i18n-navigation";
import { HeroVideo } from "@/components/home/HeroVideo";
// From a plain module, NOT from HeroVideo: a "use client" file exports only its components across
// the boundary, so reading these from there yields `undefined` on the server — see lib/hero-media.ts.
import { HERO_MOBILE_MQ, HERO_REDUCE_MQ, HERO_VIDEO_ID } from "@/lib/hero-media";
import type { HomeMedia } from "@/lib/content";

/**
 * The homepage hero: a full-bleed band that stacks two layers which only ever ADD. Nothing above
 * ever disappears to reveal something worse, and the bottom layer needs no network at all.
 *
 *   1. background colour   the footage's own mean colour, painted in the same frame the HTML
 *                          parses. Zero requests, and it survives a dead CDN, JS being off, and a
 *                          CSP that kills every script on the page. It is what a visitor sees
 *                          until the first video frame decodes, and it stays underneath forever,
 *                          so it also backs a mid-playback stall.
 *   2. <video>             transparent until it has a frame to show, then opaque and playing.
 *                          It reveals itself rather than shipping opaque because an empty <video>
 *                          paints black — see REVEAL_EVENTS in HeroVideo.tsx.
 *
 * With no media configured at all it degrades to the plain band it was before — see getHomeMedia
 * in lib/content.ts for why "nothing set" is a real state rather than a missing one.
 *
 * svh, not vh: on a phone `vh` is the LARGE viewport (URL bar retracted), so a 70vh band would
 * be taller than what you can actually see on first paint. `dvh` would resize — and re-crop the
 * video — every time the URL bar hides, which on a full-bleed object-cover hero reads as a
 * glitch. 70svh leaves a clear band of the next section showing, which is the scroll cue.
 *
 * Desktop is a fixed 600px rather than a viewport fraction. A near-full-height hero pushes the
 * first row of product below the fold on every laptop; this band is a masthead, not a splash
 * screen, so the grid underneath it starts working immediately.
 *
 * The header is fixed and this is the first thing under it, so the band also absorbs the
 * header's height — which is why Header renders no spacer on the homepage.
 */
export function Hero({ media }: { media: HomeMedia | null }) {
  if (!media) return <div className="h-[70svh] w-full bg-paper md:h-[600px]" />;

  const { src, mobileSrc, bg, origin } = media;

  return (
    <>
      {/* Warm the TLS handshake to the media host before the starter attaches a src. React 19
          hoists <link> into <head> and dedupes by href, so rendering it from inside the tree is
          safe. No crossOrigin: the <video> fetch is no-CORS, so an anonymous preconnect would
          warm a connection the video cannot reuse.

          Deliberately NOT <link rel="preload" as="video">: Chromium's support for that `as` value
          is unreliable, and a preload issues a full-body GET while the media element issues Range
          requests through a different cache — together a coin-flip double download of the clip. */}
      {origin ? <link rel="preconnect" href={origin} /> : null}

      {/* The band is a plain element and the sale link is an overlay INSIDE it, rather than the
          band being the link. That is not cosmetic: HeroVideo can raise a play button when a
          phone refuses autoplay, and a <button> nested inside an <a> is invalid HTML whose tap
          navigates instead of playing. As siblings, the button simply outranks the link. */}
      <div
        // The hook app/globals.css uses to float the announcement bar over this section instead
        // of pushing it down. It has to be CSS: app/[locale]/layout.tsx is a Server Component in
        // the prerendered shell and cannot read the pathname without pulling the whole route out
        // of it. This attribute exists only here, so `body:has([data-hero-full])` means "the
        // homepage, and only while it actually has a hero" — a descendant selector, so it does
        // not care which element carries it.
        data-hero-full
        // The floor, painted before the network answers anything. There is deliberately no
        // `bg-ink` fallback: that is a near-black, i.e. the one colour this hero must never show.
        style={{ backgroundColor: bg }}
        className="relative h-[70svh] w-full overflow-hidden md:h-[600px]"
      >
        <HeroVideo src={src} mobileSrc={mobileSrc} />
        {/* Starts the clip at HTML-PARSE time, roughly a second before hydration on a mid-range
            phone, and it is the only reason a hard refresh shows motion instantly rather than
            whenever the bundle lands. Must stay AFTER <HeroVideo/> so the element exists by the
            time it runs; it opens with getElementById(...) || return, so if React ever hoists it
            the script no-ops and HeroVideo's effect does the same work a beat later.

            The play() call is NOT redundant with the `autoplay` attribute: Chrome's autoplay
            algorithm waits for HAVE_ENOUGH_DATA (readyState 4), so a clip arriving slower than it
            plays settles at readyState 3 and native autoplay never fires.

            Adding a CSP later means putting this script's sha256 in script-src. A nonce cannot
            work: cacheComponents prerenders one static shell served to every visitor, so any
            nonce baked into it is a constant and therefore worthless.

            Emitted as the innerHTML of a layout-neutral wrapper rather than as a <script>
            ELEMENT, because React refuses to render one: on the client it swaps the tag for an
            inert div and logs "Encountered a script tag while rendering React component" (see
            createInstance in react-dom). The asymmetry of innerHTML is exactly what is wanted
            here — the server writes the tag straight into the HTML, where the parser runs it,
            while a client navigation inserts it without executing it, which is already the
            documented contract with HeroVideo's effect. */}
        <div
          style={{ display: "contents" }}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: `<script>${heroStartScript(src, mobileSrc)}</script>` }}
        />

        {/* NOTHING is painted over the video — deliberately, and it is the owner's standing rule:
            the footage shows in its own colours, exactly as exported.

            Two scrims used to live here and both are gone: a flat `bg-black/15` mood tint over the
            whole frame, and a 176px `from-black/55` gradient down the top. They multiplied, so the
            body of every clip rendered at 85% brightness and its top edge at 38% — crushed blacks
            on dark footage, which on an abaya is the whole subject.

            If anything above the hero ever needs to stay legible over bright footage, give THAT
            element its own shadow — the way [data-announce] already does in app/globals.css — and
            do not reintroduce a wash here. */}

        {/* The whole band still goes to the sale — as a stretched overlay rather than a wrapper.
            z-10 puts it over the video and both scrims; HeroVideo's play button sits at z-20 and
            wins over it, and is the only thing that does, so every other pixel of the hero is
            still one big tap target for the sale. */}
        <Link
          href="/collections/sales"
          // The hero fills the viewport, so this link is in view from the first frame and would
          // otherwise prefetch the whole /collections/sales route and its data alongside the
          // video. In Next 16 `false` also cancels the on-hover prefetch.
          prefetch={false}
          aria-label="Shop the sale"
          className="absolute inset-0 z-10"
        />
      </div>
    </>
  );
}

/**
 * The parse-time starter: pick the file for this device, mark it inline-playable, reveal it once
 * it has a frame, ask it to play. That is the whole job — every "smarter" version of this shipped
 * a bug of its own. Retries are HeroVideo's business, on a bounded schedule; this one runs once
 * and gets out of the way.
 *
 * The reveal is armed HERE as well as in HeroVideo because the element ships transparent (see
 * REVEAL_EVENTS there) and a frame routinely decodes before the bundle hydrates. Arming it only
 * in the effect would hold a ready video invisible for the length of a cold JS load.
 */
function heroStartScript(desktopSrc: string, mobileSrc: string): string {
  // A JS string literal safe to embed in HTML: every "<" is rewritten to its unicode escape,
  // which the JS parser reads back as the same character but which the HTML parser can no
  // longer see as the start of a closing script tag. The media URLs are admin-editable
  // (getHomeMedia reads the content table), so without this a value carrying a closing script
  // tag followed by markup would run as script on the homepage.
  const lit = (s: string) => JSON.stringify(s).replace(/</g, "\\u003c");
  const V = lit(HERO_VIDEO_ID);
  const RM = lit(HERO_REDUCE_MQ);
  const MQ = lit(HERO_MOBILE_MQ);
  const D = lit(desktopSrc);
  const M = lit(mobileSrc);
  return `(function(){try{
var v=document.getElementById(${V});if(!v)return;
var q=window.matchMedia;
if(q&&q(${RM}).matches)return;
var r=function(){v.style.opacity="1"};
v.addEventListener("loadeddata",r);v.addEventListener("canplay",r);v.addEventListener("playing",r);
v.muted=true;v.setAttribute("muted","");v.setAttribute("playsinline","");v.setAttribute("webkit-playsinline","");
v.src=(q&&q(${MQ}).matches)?${M}:${D};
var p=v.play();if(p&&p.catch)p.catch(function(){});
}catch(e){}})()`;
}
