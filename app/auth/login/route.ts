import { authorizationURL, configured, randomToken, safeReturnTo, stateCookieValue } from '../oidc';

export async function GET(request: Request) {
  if (!configured()) return new Response('SSO is not configured', { status: 503 });
  const url = new URL(request.url); const state = randomToken(); const nonce = randomToken(); const returnTo = safeReturnTo(url.searchParams.get('return_to')); const redirectURL = process.env.PHONICS_OIDC_REDIRECT_URL || `${url.origin}/auth/callback`;
  const target = await authorizationURL(state, nonce, redirectURL);
  return new Response(null, { status: 302, headers: { Location: target, 'Set-Cookie': stateCookieValue(`${state}|${nonce}|${returnTo}`) } });
}
