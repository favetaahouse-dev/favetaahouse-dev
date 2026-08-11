import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Media lives in this project's Storage; parse once so images.remotePatterns can allow it.
// SUPABASE_URL first: this runs at build, where it is available, so the project needs no
// separate NEXT_PUBLIC_ copy just to name its own Storage host.
const supabaseOrigin = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseOrigin ? new URL(supabaseOrigin) : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS — only meaningful over HTTPS (ignored on localhost). 2 years + preload.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  turbopack: { root: dir },
  // Partial Prerendering: the nav, footer and product grids are prerendered into a static
  // shell served from the CDN, while the cart — the only genuinely per-visitor part —
  // streams in at request time. Without this every page re-queried Singapore on every hit.
  cacheComponents: true,
  // `next dev` also listens on the machine's LAN address, and Next blocks cross-origin
  // requests to dev-only endpoints (/_next/webpack-hmr) unless the origin is named here —
  // so opening the printed Network URL, or the site on a phone, loaded the page with HMR
  // dead. Private ranges only, and the option has no effect on a production build.
  allowedDevOrigins: ["169.254.*.*", "192.168.*.*", "10.*.*.*", "172.16.*.*"],
  images: {
    // Product imagery is served from Supabase Storage, which is already CDN-backed and
    // stores one right-sized variant per photo, so there is nothing to re-optimize.
    unoptimized: true,
    // Honoured if optimization is ever turned back on; harmless while unoptimized.
    remotePatterns: supabaseHost
      ? [{ protocol: supabaseHost.protocol.replace(":", "") as "http" | "https", hostname: supabaseHost.hostname, port: supabaseHost.port, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Vercel serves public/ with `max-age=0, must-revalidate`, so the hero image — the
        // homepage's LCP element — costs a conditional GET on every repeat visit. These files
        // only change on a deploy, and a deploy changes nothing for a client that already has
        // them. NOT `immutable`: the filenames are not content-hashed, so a redeployed asset
        // must eventually win. A week fresh plus a month of stale-while-revalidate is the trade.
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
