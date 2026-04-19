import type { NextAuthRequest } from 'next-auth';
import { NextResponse } from 'next/server';

import { auth } from './auth';

export const middleware = auth((req: NextAuthRequest) => {
  const session = req.auth;

  // If the token couldn't be refreshed, force re-login
  if (session?.error === 'RefreshTokenError') {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Unauthenticated users on /dashboard/** → login
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/auth/:path*'],
};
