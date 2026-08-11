"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HERO_MOBILE_MQ, HERO_REDUCE_MQ, HERO_VIDEO_ID } from "@/lib/hero-media";

/**
 * The hero's <video>.
 *
 * A browser's media stack already handles buffering, stalling, looping and recovery correctly on
 * every codec and network there is, so this component does none of that. It only covers the four
 * things a browser genuinely will not do on its own:
 *
 *   1. Choose between the phone and desktop cut. `<source media>` cannot — Chromium ignores the
 *      attribute on media elements — and the markup has to be device-agnostic anyway, because
 *      cacheComponents prerenders ONE shell that every visitor receives.
 *   2. Retry play() after a user gesture. iOS Low Power Mode refuses autoplay outright, even for
 *      a muted, audio-free clip, and a trusted gesture is the only thing that lifts it.
 *   3. Resume after a tab switch or a Safari bfcache restore — both hand back a paused element
 *      that nothing else will start.
 *   4. Retry once on a hard media error, for a transient network failure.
 *
 * And one rule that is not negotiable:
 *
 *      NOTHING IN HERE EVER CALLS pause().
 *
 * pause() unconditionally clears an element's "can autoplay" flag (HTML spec, the pause()
 * algorithm). A single call — an IntersectionObserver pausing while the element measures zero
 * area during load, say, which it does, because the hero's height comes from a stylesheet —
 * permanently disables the autoplay attribute and strands the hero on a frozen frame at t=0.
 */

/**
 * The events that actually grant user activation. Per the HTML spec's "activation triggering
 * input event" list, on a phone that is `touchend` and `pointerup` — `touchstart` is NOT on it, so
 * a rescue built on touchstart calls play() at the one moment WebKit is guaranteed to refuse.
 *
 * Armed for the component's whole lifetime rather than behind a condition: Low Power Mode can
 * engage mid-session, not only at load.
 */
const GESTURES = ["touchend", "pointerup", "click", "keydown"] as const;

/**
 * Moments when a stopped element might be startable again. None of these inspect the buffer —
 * they just re-ask, and re-asking costs nothing when the element is already rolling. `progress`
 * carries the weight on a cold load: it fires as bytes land, so a clip that had nothing to play
 * when the first attempt went out gets another with every chunk that arrives.
 */
const RETRY_EVENTS = ["pause", "canplay", "loadeddata", "progress", "stalled", "waiting"] as const;

/**
 * A hard refresh is the hostile case: the starter's play() goes out while the JS bundle, fonts
 * and product images are all still in flight, and if it is refused nothing tries again
 * until a visitor touches the screen. So the start is retried on a short, bounded schedule that
 * spans a typical cold load, cancelled the moment the clip actually rolls. These are play() calls
 * and nothing else — no seeking, no load(), no source switching — so a wasted one costs a
 * rejected promise nobody reads.
 */
const RETRY_AFTER_MS = [250, 800, 2000, 4000, 8000] as const;

/**
 * The one job the old `poster` attribute did that nothing else covers: a <video> with no poster
 * paints an OPAQUE BLACK box before its first frame decodes. That would sit on top of the mean
 * colour Hero.tsx paints underneath — i.e. it would put back the exact black flash the whole
 * layered hero exists to prevent.
 *
 * So the element ships transparent and is revealed the moment there is a real frame behind it.
 * Any one of these firing is enough, and the readyState check below covers a frame that decoded
 * before this bundle ever hydrated — which on a fast connection it will have, because the
 * parse-time starter in Hero.tsx sets `src` roughly a second earlier.
 */
const REVEAL_EVENTS = ["loadeddata", "canplay", "playing"] as const;

/**
 * The reduced-motion preference as an external store rather than effect state. Module-level so the
 * subscribe identity is stable, a false server snapshot so the prerendered shell never guesses at
 * a setting it cannot see, and a live subscription because this can be toggled mid-visit.
 */
const subscribeReduced = (onChange: () => void) => {
  const mq = window.matchMedia(HERO_REDUCE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const readReduced = () => window.matchMedia(HERO_REDUCE_MQ).matches;
const readReducedOnServer = () => false;

export function HeroVideo({ src, mobileSrc }: { src: string; mobileSrc: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, readReducedOnServer);
  /** Raised only by proof: a play() the browser rejected with NotAllowedError. */
  const [refused, setRefused] = useState(false);
  /** Set the first time playback actually begins, by the `playing` event. Never unset. */
  const [started, setStarted] = useState(false);

  /**
   * Offer a play button only when the clip will NOT start on its own and has not already been
   * going. Both inputs are proof rather than guesswork, and `started` is what retires the button
   * for good — after the first frame rolls, an ordinary pause (tab hidden, OS media key) is the
   * retry machinery's business, not something to put a control on screen for.
   *
   * It follows that a hero autoplaying normally never renders a button, not even for one frame.
   */
  const blocked = (reduced || refused) && !started;

  /** Attach the right cut for this device, if nothing has yet. Shared by the effect and the button. */
  const attachSrc = useCallback(
    (el: HTMLVideoElement) => {
      if (!el.getAttribute("src")) {
        el.src = window.matchMedia(HERO_MOBILE_MQ).matches ? mobileSrc : src;
      }
    },
    [src, mobileSrc],
  );

  /**
   * The button's job. Runs inside a trusted gesture, which is the one thing that lifts every
   * autoplay restriction there is — including Low Power Mode, which nothing else can.
   */
  const start = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    attachSrc(el); // reduced-motion visitors have no src until exactly this moment
    // No .then here: the `playing` event is what retires the button, and it is the only signal
    // that means playback genuinely began rather than merely being permitted.
    void el.play().catch(() => {});
  }, [attachSrc]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let disposed = false;

    /** Idempotent and never reversed — see REVEAL_EVENTS. */
    const reveal = () => {
      el.style.opacity = "1";
    };
    if (el.readyState >= 2 /* HAVE_CURRENT_DATA */) reveal();

    // These two are armed BEFORE the reduced-motion bail, because they have to work for a clip the
    // BUTTON started just as much as for one that autoplayed.
    const onPlaying = () => setStarted(true);
    for (const e of REVEAL_EVENTS) el.addEventListener(e, reveal);
    el.addEventListener("playing", onPlaying);
    const disarmAlways = () => {
      for (const e of REVEAL_EVENTS) el.removeEventListener(e, reveal);
      el.removeEventListener("playing", onPlaying);
    };

    // Read LIVE, not from `reduced`. useSyncExternalStore hands out the server snapshot (false)
    // during hydration and only corrects on the pass after, so gating on it here would set a src
    // and start playing before the correction landed — the exact thing this branch exists to
    // prevent, and unfixable afterwards because nothing may call pause(). The store value is for
    // RENDERING the button; this is the imperative decision and it needs the truth now.
    //
    // A deliberate OS-level setting, so it still wins: nothing autoplays and not one video byte is
    // fetched. The button (raised by `reduced` a beat later) keeps it the visitor's call rather
    // than leaving them a flat colour band with no way in.
    if (window.matchMedia(HERO_REDUCE_MQ).matches) return disarmAlways;

    // Normally the inline starter in Hero.tsx already did this, ~1s earlier. This covers the
    // cases where it did not run at all: a CSP without its hash, a proxy that strips inline
    // scripts, or a client-side navigation onto the homepage (React does not execute it then).
    attachSrc(el);

    /**
     * Never awaited, never gated. The rejection is no longer swallowed blind: NotAllowedError is
     * the browser saying "not without a gesture", which is the ONE failure a button can fix. Every
     * other rejection — AbortError from a newer load interrupting this attempt, most commonly — is
     * still just "not yet", and must NOT put a control on screen.
     */
    const play = () => {
      if (disposed) return;
      void el.play().catch((err: unknown) => {
        if (!disposed && (err as DOMException | null)?.name === "NotAllowedError") setRefused(true);
      });
    };

    /**
     * Only act when it is genuinely stopped. These handlers fire often — `pause` from an OS media
     * key, `canplay` on every buffer recovery — and play() on a playing element is a wasted
     * promise. The `document.hidden` guard avoids fighting a browser that pauses on hide; the
     * visibilitychange listener is what resumes in that case.
     */
    const resume = () => {
      if (el.paused && !document.hidden) play();
    };

    /** `loop` should make this unreachable; WebKit fires it anyway when the wrap lands on a
     *  boundary it has not buffered. */
    const onEnded = () => {
      try {
        el.currentTime = 0;
      } catch {}
      play();
    };

    /**
     * Exactly one retry, ever. A transient network failure deserves a second chance; a loop of
     * load() calls deserves nothing — and on WebKit every load() resets the element's
     * gesture-unlocked state, which is the one thing that can still rescue it after this.
     */
    let retried = false;
    const onError = () => {
      if (retried || disposed) return;
      retried = true;
      el.load();
      play();
    };

    let timers = RETRY_AFTER_MS.map((ms) => window.setTimeout(resume, ms));
    const stopRetrying = () => {
      for (const t of timers) window.clearTimeout(t);
      timers = [];
    };

    for (const e of RETRY_EVENTS) el.addEventListener(e, resume);
    for (const g of GESTURES) window.addEventListener(g, resume, { passive: true });
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.addEventListener("playing", stopRetrying);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    play();

    return () => {
      disposed = true;
      stopRetrying();
      disarmAlways();
      for (const e of RETRY_EVENTS) el.removeEventListener(e, resume);
      for (const g of GESTURES) window.removeEventListener(g, resume);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeEventListener("playing", stopRetrying);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      // Deliberately no el.pause(). See the note at the top of this file.
    };
  }, [src, mobileSrc, attachSrc, reduced]);

  return (
    <>
      <video
        ref={ref}
        id={HERO_VIDEO_ID}
        autoPlay
        muted
        loop
        playsInline
        // The owner's rule: motion instantly, at full quality. "metadata" would hold the first
        // frame back behind a second round trip for a file the CDN already serves a year of cache.
        preload="auto"
        aria-hidden
        tabIndex={-1}
        disablePictureInPicture
        // An AirPlay/Cast handoff moves playback to another device and pauses this element.
        disableRemotePlayback
        // Transparent until there is a frame to show — see REVEAL_EVENTS. Inline rather than a
        // Tailwind class so the parse-time starter can flip it without waiting for the stylesheet,
        // and no transition: a fade would announce the swap, where the point is nobody notices.
        style={{ opacity: 0 }}
        // The starter assigns `src` AND flips that opacity before hydration, so the live DOM
        // legitimately differs from the server HTML on both. React never re-renders either after
        // mount, so nothing is clobbered.
        suppressHydrationWarning
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Only ever rendered once autoplay has actually been refused, so the common path never
          shows a control. The WRAPPER is inert and the button alone takes pointer events: the
          band's sale link sits underneath at z-10, and swallowing the whole hero to it would cost
          the storefront its largest tap target for the sake of a 64px control. */}
      {blocked ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <button
            type="button"
            onClick={start}
            aria-label="Play video"
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-white/70 bg-black/35 text-white backdrop-blur-[2px] transition-colors hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {/* Inline, not lucide-react: this is the homepage's critical path and the glyph is
                four points. Nudged right by 2px because a triangle's optical centre is not its
                bounding box's. */}
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="ms-[2px] h-6 w-6 fill-current"
              focusable="false"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      ) : null}
    </>
  );
}
