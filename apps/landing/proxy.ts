import { auth } from './auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard');
  const isAuthPage =
    req.nextUrl.pathname === '/login' ||
    req.nextUrl.pathname === '/register';

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
