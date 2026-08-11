/**
 * Constants shared by the hero's server shell (components/home/Hero.tsx) and its client player
 * (components/home/HeroVideo.tsx).
 *
 * They live in a plain module rather than beside the player for a reason that is easy to get
 * wrong: when a Server Component imports from a "use client" file, only the COMPONENT exports
 * survive the boundary — every other export resolves to `undefined` on the server. Declaring
 * these in HeroVideo.tsx and reading them from Hero.tsx compiled and typechecked cleanly, then
 * emitted `document.getElementById(undefined)` into the page, so the parse-time starter silently
 * did nothing and the hero only began playing at hydration.
 */

/** The one <video> on the page; how the inline starter finds the element it has to start. */
export const HERO_VIDEO_ID = "hero-video";

/**
 * The device split. It has to happen in the browser: `<source media>` cannot do it (Chromium
 * ignores the attribute on media elements) and the markup has to be device-agnostic anyway,
 * because cacheComponents prerenders a single shell that every visitor receives.
 */
export const HERO_MOBILE_MQ = "(max-width: 767px)";

/**
 * The only rule that may keep the video from playing at all. A full-bleed autoplaying hero is
 * exactly what this preference opts out of, and it is a deliberate OS setting rather than a
 * browser quirk, so it wins: not one video byte is fetched and the hero band stays on the
 * footage's mean colour (heroBg), which is now the whole of what these visitors see.
 *
 * There is deliberately no Save-Data or 2G rule beside it. Those silently swap the video for a
 * still on connections that could have played it, which is indistinguishable from the hero
 * being broken.
 */
export const HERO_REDUCE_MQ = "(prefers-reduced-motion: reduce)";
