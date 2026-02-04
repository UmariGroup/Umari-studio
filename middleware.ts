import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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
  const authToken = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;

  // Parse token payload
  const userPayload = authToken ? await verifyEdgeJwt(authToken) : null;

  // ============================================
  // ADMIN ROUTES - Strict Protection
  // ============================================
  if (pathname.startsWith('/admin')) {
    // Require authentication
    if (!authToken || !userPayload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Require admin role
    if (userPayload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Admins don't need subscription check - they have full access
    return NextResponse.next();
  }

  // ============================================
  // DASHBOARD ROUTES - User Protection
  // ============================================
  if (pathname.startsWith('/dashboard')) {
    // Require authentication
    if (!authToken || !userPayload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // ============================================
  // PRICING ROUTE - Only for unauthenticated or free users
  // ============================================
  if (pathname === '/pricing') {
    if (authToken && userPayload && userPayload.subscription_status === 'active') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // ============================================
  // LOGIN/REGISTER - Redirect if already authenticated
  // ============================================
  if (pathname === '/login' || pathname === '/register') {
    if (authToken && userPayload) {
      if (userPayload.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/pricing',
    '/login',
    '/register',
    '/api/:path*',
  ],
};

