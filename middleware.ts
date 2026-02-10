import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

type Language = 'uz' | 'ru';

function parseLocalePrefix(pathname: string): { lang: Language; strippedPathname: string } | null {
  const match = pathname.match(/^\/(uz|ru)(\/|$)/);
  if (!match) return null;
  const lang = match[1] as Language;
  const stripped = pathname.replace(/^\/(uz|ru)(?=\/|$)/, '') || '/';
  return { lang, strippedPathname: stripped };
}

async function verifyEdgeJwt(token: string) {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as any;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const originalPathname = request.nextUrl.pathname;
  const locale = parseLocalePrefix(originalPathname);
  const pathname = locale?.strippedPathname ?? originalPathname;
  const localePrefix = locale ? `/${locale.lang}` : '';

  // Avoid locale prefixes for API routes
  if (locale && pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL(pathname, request.url));
  }

  // Block Next.js Server Action calls early.
  // We currently don't use Server Actions in this app; these requests are most often
  // from stale deployments (cached HTML) or automated probes, and they spam logs with:
  // "Failed to find Server Action ...".
  const nextAction = request.headers.get('next-action');
  if (request.method === 'POST' && nextAction) {
    return new NextResponse('Bad Request', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
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
    return response;
  }

  const authToken = request.cookies.get('auth_token')?.value;

  const needsAuthPayload =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname === '/pricing' ||
    pathname === '/login' ||
    pathname === '/register';

  // Parse token payload only when needed
  const userPayload = needsAuthPayload && authToken ? await verifyEdgeJwt(authToken) : null;

  // ============================================
  // ADMIN ROUTES - Strict Protection
  // ============================================
  if (pathname.startsWith('/admin')) {
    // Require authentication
    if (!authToken || !userPayload) {
      return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
    }

    // Require admin role
    if (userPayload.role !== 'admin') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }

    // Admins don't need subscription check - they have full access
    if (!locale) {
      return NextResponse.next();
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
    return response;
  }

  // ============================================
  // DASHBOARD ROUTES - User Protection
  // ============================================
  if (pathname.startsWith('/dashboard')) {
    // Require authentication
    if (!authToken || !userPayload) {
      return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
    }
  }

  // ============================================
  // PRICING ROUTE - Only for unauthenticated or free users
  // ============================================
  if (pathname === '/pricing') {
    if (authToken && userPayload && userPayload.subscription_status === 'active') {
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
  }

  // ============================================
  // LOGIN/REGISTER - Redirect if already authenticated
  // ============================================
  if (pathname === '/login' || pathname === '/register') {
    if (authToken && userPayload) {
      if (userPayload.role === 'admin') {
        return NextResponse.redirect(new URL(`${localePrefix}/admin`, request.url));
      }
      return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, request.url));
    }
  }

  // ============================================
  // API Routes - Security Headers
  // ============================================
  if (pathname.startsWith('/api')) {
    // Add security headers
    const response = NextResponse.next();
    
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    return response;
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
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run middleware on all non-static routes so we can block invalid Server Action calls
    // and still apply auth redirects where needed.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

