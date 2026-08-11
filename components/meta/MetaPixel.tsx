import { Suspense } from "react";
import Script from "next/script";
import { META_PIXEL_ID, metaPixelEnabled } from "@/lib/meta/config";
import { MetaRouteTracker } from "./MetaRouteTracker";

/**
 * The Meta Pixel base snippet.
 *
 * MOUNTED ONLY IN THE STOREFRONT ROOT (app/[locale]/layout.tsx). The admin panel has its own
 * separate <html> at app/admin/layout.tsx and must stay untracked — every admin session would
 * otherwise land in the owner's own retargeting audiences and lookalikes, quietly poisoning them.
 *
 * `afterInteractive` rather than `beforeInteractive`: the pixel has nothing to do with rendering,
 * and beforeInteractive would block hydration on a third-party request. It also must not be
 * `lazyOnload` — that waits for the window load event, which on an image-heavy product page can
 * be seconds, and a PageView that late loses attribution.
 *
 * Renders nothing itself, so it costs no layout and cannot affect LCP.
 *
 * A note for whoever adds a Content-Security-Policy later: this snippet is inline, so it needs
 * its sha256 in `script-src`. A nonce cannot work here — cacheComponents prerenders ONE static
 * shell that is served to every visitor, so any nonce baked into it is a constant and therefore
 * no protection at all. The same reasoning is documented on the hero's inline script.
 */
export function MetaPixel() {
  if (!metaPixelEnabled) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        // The stock Meta snippet. `fbq` is stubbed synchronously and queues calls until
        // fbevents.js lands, so trackMeta() is safe to call immediately after this runs.
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');`,
        }}
      />
      {/* The initial PageView is fired by the tracker, not here — see MetaRouteTracker for why
          doing both would double-count every landing.

          The Suspense boundary is NOT optional. MetaRouteTracker reads usePathname(), which under
          cacheComponents is runtime data on any route with an un-enumerated param — without a
          boundary the production build fails outright with "Uncached data was accessed outside of
          <Suspense>" on /[locale]/account/orders/[id]. The layout wraps <Header/> for exactly the
          same reason. Renders nothing, so the fallback is null and nothing shifts. */}
      <Suspense fallback={null}>
        <MetaRouteTracker />
      </Suspense>
    </>
  );
}
