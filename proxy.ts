import { NextResponse, type NextRequest } from 'next/server';
import { createLimiter, visitorKey } from './src/limit.mjs';

const allow = createLimiter();
// next/link prefetches every link in view: a page of blocks is dozens of them, counted apart
const allowPrefetch = createLimiter(600);

// A per-visitor request limit in front of every page and API route (each one asks the node), and
// a nonce-based CSP on pages: Next applies the nonce from the request header to its own scripts.
export function proxy(request: NextRequest) {
  const prefetch =
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch';
  const { allowed, retryAfter } = (prefetch ? allowPrefetch : allow)(
    visitorKey(request.headers.get('x-real-ip'))
  );
  if (!allowed)
    return new NextResponse(
      'Too many requests to the explorer. Please wait a minute.',
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  if (prefetch || request.nextUrl.pathname.startsWith('/api/'))
    return NextResponse.next();
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(18))
  ).toString('base64');
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return response;
}

export const config = {
  // the basePath root (/explorer) is matched as '/' only when listed on its own
  matcher: ['/', '/((?!_next/static|_next/image|icon.svg).*)'],
};
