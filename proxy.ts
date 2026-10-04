import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { safeAnalyticsProxyHeaders } from './lib/analytics/posthog';

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/v-events/')) {
    // Same-origin analytics must not forward VANTRA auth cookies or credentials.
    return NextResponse.next({ request: { headers: safeAnalyticsProxyHeaders(request.headers) } });
  }
  const response = handleI18nRouting(request);

  if (request.nextUrl.pathname === '/') {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'Cookie, Accept-Language');
  }

  return response;
}

export const config = {
  matcher: ['/', '/(privacy|terms|billing)', '/(fr|ar|en)/:path*', '/v-events/:path*'],
};
