import { NextResponse } from 'next/server';
import { contentAuthRequired, parseCookie, verifySession } from './app/auth/oidc';

export async function middleware(request: Request) {
  if (!contentAuthRequired()) return NextResponse.next();

  const session = parseCookie(request.headers.get('cookie'), 'phonics_session');
  try {
    if (await verifySession(session)) return NextResponse.next();
  } catch {
    // Treat malformed or unverifiable cookies as anonymous.
  }

  const loginURL = new URL('/auth/login', request.url);
  const requestURL = new URL(request.url);
  loginURL.searchParams.set('return_to', `${requestURL.pathname}${requestURL.search}`);
  return NextResponse.redirect(loginURL);
}

export const config = { matcher: ['/'] };
