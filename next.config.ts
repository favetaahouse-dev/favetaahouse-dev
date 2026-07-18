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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
