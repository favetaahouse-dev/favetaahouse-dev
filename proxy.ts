import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the `middleware` file convention to `proxy`.
const handleI18n = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Admin lives outside the [locale] segment — do not run i18n routing on it.
  // (Access control is enforced by the app/admin/(panel) server layout guard
  //  and requireAdmin() on every /api/admin route.)
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  return handleI18n(request);
}

export const config = {
  // Skip Next internals, API routes, and any file with an extension (public assets).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
