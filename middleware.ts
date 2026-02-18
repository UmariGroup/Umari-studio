import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

type Language = 'uz' | 'ru';

const ACCESS_COOKIE_NAME = process.env.AUTH_ACCESS_COOKIE || 'umari_access';
const REFRESH_COOKIE_NAME = process.env.AUTH_REFRESH_COOKIE || 'umari_refresh';
const LEGACY_COOKIE_NAME = 'auth_token';
const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || ACCESS_SECRET;

function parseLocalePrefix(pathname: string): { lang: Language; strippedPathname: string } | null {
  const match = pathname.match(/^\/(uz|ru)(\/|$)/);
  if (!match) return null;
  const lang = match[1] as Language;
  const stripped = pathname.replace(/^\/(uz|ru)(?=\/|$)/, '') || '/';
  return { lang, strippedPathname: stripped };
}

async function verifyEdgeJwt(
  token: string,
  secret: string,
  expectedType?: 'access' | 'refresh'
) {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    const tokenType = payload?.token_type;
    if (expectedType === 'refresh' && tokenType !== 'refresh') return null;
    if (expectedType === 'access' && tokenType && tokenType !== 'access') return null;
    return payload as any;
  } catch {
    return null;
  }
}

function applySecurityHeaders(response: NextResponse, opts?: { noStore?: boolean }) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  if (opts?.noStore) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const originalPathname = request.nextUrl.pathname;
  const locale = parseLocalePrefix(originalPathname);
  const pathname = locale?.strippedPathname ?? originalPathname;
  const localePrefix = locale ? `/${locale.lang}` : '';

  // Referral capture: persist ?ref=CODE in a cookie so auth routes can attach it.
  const refParam = request.nextUrl.searchParams.get('ref') || request.nextUrl.searchParams.get('referral');
  const referralFromUrl = refParam ? String(refParam).trim().toUpperCase() : '';
  const referralIsValid = /^[A-Z0-9]{6,16}$/.test(referralFromUrl);

  const withReferralCookie = (res: NextResponse) => {
    if (referralIsValid) {
      res.cookies.set('referral_code', referralFromUrl, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    }
    return res;
  };

  // Allow public/static asset files to pass through without locale redirects.
  // Otherwise requests like /examples/foo.png would be redirected to /uz/examples/foo.png and 404.
  const isPublicAsset = /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml|json|woff2?|ttf|eot)$/i.test(originalPathname);
  if (isPublicAsset) {
    return withReferralCookie(NextResponse.next());
  }

  // Avoid locale prefixes for API routes
  if (locale && pathname.startsWith('/api')) {
    return withReferralCookie(NextResponse.redirect(new URL(pathname, request.url)));
  }

  // Block Next.js Server Action calls early.
  // We currently don't use Server Actions in this app; these requests are most often
  // from stale deployments (cached HTML) or automated probes, and they spam logs with:
  // "Failed to find Server Action ...".
  const nextAction = request.headers.get('next-action');
  if (request.method === 'POST' && nextAction) {
    return withReferralCookie(
      new NextResponse('Bad Request', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      })
    );
  }

  // Default locale routing: if there is no /uz or /ru prefix, redirect.
  // Keep API routes un-prefixed.
  if (!locale && !originalPathname.startsWith('/api')) {
    const cookieLang = request.cookies.get('language')?.value;
    const preferred = cookieLang === 'ru' ? 'ru' : 'uz';

    const url = request.nextUrl.clone();
    url.pathname = originalPathname === '/' ? `/${preferred}` : `/${preferred}${originalPathname}`;

    const response = NextResponse.redirect(url);
    response.cookies.set('language', preferred, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return withReferralCookie(response);
  }

  const accessToken =
    request.cookies.get(ACCESS_COOKIE_NAME)?.value || request.cookies.get(LEGACY_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  const needsAuthPayload =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/admin') ||
    pathname === '/pricing' ||
    pathname === '/login' ||
    pathname === '/register';

  // Parse token payload only when needed
  let userPayload: any = null;
  if (needsAuthPayload) {
    if (accessToken) {
      userPayload =
        (await verifyEdgeJwt(accessToken, ACCESS_SECRET, 'access')) ||
        (await verifyEdgeJwt(accessToken, ACCESS_SECRET));
    }
    if (!userPayload && refreshToken) {
      userPayload = await verifyEdgeJwt(refreshToken, REFRESH_SECRET, 'refresh');
    }
  }

  // ============================================
  // ADMIN ROUTES - Strict Protection
  // ============================================
  if (pathname.startsWith('/admin')) {
    // Require authentication
    if (!userPayload) {
      return withReferralCookie(NextResponse.redirect(new URL(`${localePrefix}/login`, request.url)));
    }

    // Require admin role
    if (userPayload.role !== 'admin') {
      return withReferralCookie(NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url)));
    }

    // Admins don't need subscription check - they have full access
    if (!locale) {
      return withReferralCookie(applySecurityHeaders(NextResponse.next(), { noStore: true }));
    }

    const headers = new Headers(request.headers);
    headers.set('x-language', locale.lang);
    const response = NextResponse.rewrite(new URL(pathname, request.url), {
      request: { headers },
    });
    response.cookies.set('language', locale.lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return withReferralCookie(applySecurityHeaders(response, { noStore: true }));
  }

  // ============================================
  // DASHBOARD ROUTES - User Protection
  // ============================================
  if (pathname.startsWith('/dashboard')) {
    // Require authentication
    if (!userPayload) {
      return withReferralCookie(NextResponse.redirect(new URL(`${localePrefix}/login`, request.url)));
    }
  }

  // ============================================
  // PRICING ROUTE - Only for unauthenticated or free users
  // ============================================
  if (pathname === '/pricing') {
    if (userPayload && userPayload.subscription_status === 'active') {
      return withReferralCookie(NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url)));
    }
  }

  // ============================================
  // LOGIN/REGISTER - Redirect if already authenticated
  // ============================================
  if (pathname === '/login' || pathname === '/register') {
    if (userPayload) {
      if (userPayload.role === 'admin') {
        return withReferralCookie(NextResponse.redirect(new URL(`${localePrefix}/admin`, request.url)));
      }
      return withReferralCookie(NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url)));
    }
  }

  if (pathname.startsWith('/api/admin') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    const expectedOrigin = request.nextUrl.origin;
    const expectedHost = request.nextUrl.host;
    const secFetchSite = request.headers.get('sec-fetch-site');

    const originOk = !origin || origin === expectedOrigin;
    const hostOk = !host || host === expectedHost;
    const fetchSiteOk = !secFetchSite || secFetchSite === 'same-origin' || secFetchSite === 'same-site';

    if (!originOk || !hostOk || !fetchSiteOk) {
      return withReferralCookie(
        applySecurityHeaders(
          NextResponse.json({ error: 'CSRF protection: invalid request origin' }, { status: 403 }),
          { noStore: true }
        )
      );
    }
  }

  // ============================================
  // API Routes - Security Headers
  // ============================================
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    return withReferralCookie(applySecurityHeaders(response, { noStore: pathname.startsWith('/api/admin') }));
  }

  if (locale) {
    const headers = new Headers(request.headers);
    headers.set('x-language', locale.lang);

    const response = NextResponse.rewrite(new URL(pathname, request.url), {
      request: { headers },
    });
    response.cookies.set('language', locale.lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return withReferralCookie(applySecurityHeaders(response, { noStore: pathname.startsWith('/admin') }));
  }

  return withReferralCookie(applySecurityHeaders(NextResponse.next()));
}

export const config = {
  matcher: [
    // Run middleware on all non-static routes so we can block invalid Server Action calls
    // and still apply auth redirects where needed.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

