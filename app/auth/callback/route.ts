import { clearStateCookie, exchange, parseCookie, sessionCookieValue, signSession, verifyIDToken } from '../oidc';

export async function GET(request: Request) {
  const url = new URL(request.url); const state = parseCookie(request.headers.get('cookie'), 'phonics_oauth_state'); const parts = state.split('|');
  if (parts.length !== 3 || parts[0] !== url.searchParams.get('state')) return new Response('Invalid SSO state', { status: 400 });
  try { const redirectURL = process.env.PHONICS_OIDC_REDIRECT_URL || `${url.origin}/auth/callback`; const token = await exchange(url.searchParams.get('code') || '', redirectURL); const claims = await verifyIDToken(token.id_token, parts[1]); const session = await signSession({ sub: claims.sub, email: claims.email, username: claims.preferred_username || claims.email, display_name: claims.name || claims.preferred_username || claims.email, role: 'user', exp: Math.floor(Date.now() / 1000) + 86400 }); const headers = new Headers({ Location: parts[2] }); headers.append('Set-Cookie', sessionCookieValue(session)); headers.append('Set-Cookie', clearStateCookie()); return new Response(null, { status: 302, headers }); } catch { return new Response('SSO login failed', { status: 401, headers: { 'Set-Cookie': clearStateCookie() } }); }
}
