import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  if (request.nextUrl.pathname === '/') {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'Cookie, Accept-Language');
  }

  return response;
}

export const config = {
  matcher: ['/', '/(fr|ar|en)/:path*'],
};
