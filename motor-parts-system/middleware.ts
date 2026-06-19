import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Legacy URL: no app route at /pedidos — redirect before auth/route matching (fixes 404 in production when config redirects run after middleware).
    if (pathname === '/pedidos' || pathname === '/pedidos/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Public routes that don't require authentication (landing, login, register, ipmach, forgot/reset password)
    const publicPaths = ['/', '/login', '/register', '/ipmach', '/forgot-password', '/reset-password'];
    if (publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
      return NextResponse.next();
    }
    
    // Also allow /api/auth routes
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    // API routes that don't require authentication (except auth routes)
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
      // Public API: IPMach ask (assistant consults catalog as knowledge base, no auth)
      if (pathname.startsWith('/api/ipmach/ask')) {
        return NextResponse.next();
      }
      // Public API: Stripe webhook must be accessible without user session
      if (pathname.startsWith('/api/webhooks/stripe')) {
        return NextResponse.next();
      }
      // Public API: Stripe Checkout success redirect (marks order paid server-side)
      if (pathname.startsWith('/api/payments/stripe-return')) {
        return NextResponse.next();
      }
      // Check if user is authenticated for API routes
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.next();
    }

    // Check if user is authenticated
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Role-based access control
    if (pathname.startsWith('/users') && token.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Analytics routes - admin only
    if (pathname.startsWith('/analytics') && token.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Block clients from /search, redirect to /client-search
    if (pathname.startsWith('/search') && !pathname.startsWith('/search/') && token.role === 'client') {
      return NextResponse.redirect(new URL('/client-search', req.url));
    }

    // Block non-clients from /client-search
    if (pathname.startsWith('/client-search') && token.role !== 'client') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Credit & portfolio page — clients only
    if (pathname.startsWith('/credit') && token.role !== 'client') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Allow access to all other routes for authenticated users
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;
        // Allow /pedidos through so middleware can redirect to /dashboard (withAuth would block before inner middleware otherwise).
        if (pathname === '/pedidos' || pathname === '/pedidos/') {
          return true;
        }
        const isPublic = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password' || pathname.startsWith('/ipmach');
        if (pathname.startsWith('/api/payments/stripe-return')) {
          return true;
        }
        if (pathname.startsWith('/api/webhooks/stripe')) {
          return true;
        }
        return isPublic || !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - ipmach-logo.png (IPMach logo)
     * - brands (brand logos folder)
     * - logo.png, logo-proshel-old.png (other logos)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|brands).*)',
  ],
};
