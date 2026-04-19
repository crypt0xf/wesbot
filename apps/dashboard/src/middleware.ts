import type { NextAuthRequest } from 'next-auth';
import { NextResponse } from 'next/server';

import { auth } from './auth';

export const middleware = auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // Auth API routes are handled by the route handler — don't intercept them.
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const session = req.auth;

  // Token refresh permanently failed → force re-login.
  if (session?.error === 'RefreshTokenError') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Unauthenticated users on /dashboard/** → login.
  if (!session && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/auth/:path*'],
};
