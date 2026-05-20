import { auth } from './auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const isLoginPage = nextUrl.pathname === '/login';

  if (!session) {
    if (isLoginPage) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if ((session.user as any)?.role !== 'admin') {
    return NextResponse.redirect(new URL('/login?error=unauthorized', nextUrl));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
