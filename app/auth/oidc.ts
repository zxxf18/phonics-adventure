const issuer = (process.env.PHONICS_OIDC_ISSUER || 'https://sso.yebuluo.com.cn').replace(/\/$/, '');
const clientId = process.env.PHONICS_OIDC_CLIENT_ID || 'phonics';
const clientSecret = process.env.PHONICS_OIDC_CLIENT_SECRET || '';
const sessionSecret = process.env.PHONICS_OIDC_SESSION_SECRET || '';

function decodePart(input: string) { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(input.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); }
function encodePart(value: unknown) { return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
export function randomToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
async function hmac(value: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(sessionSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)); return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }

export function configured() { return Boolean(clientSecret && sessionSecret.length >= 32); }
export function safeReturnTo(raw: string | null) { if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return '/'; return raw; }
export function stateCookieValue(value: string) { return `phonics_oauth_state=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`; }
export function sessionCookieValue(value: string) { return `phonics_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`; }
export function clearSessionCookie() { return 'phonics_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'; }
export function clearStateCookie() { return 'phonics_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'; }
export function parseCookie(header: string | null, name: string) { const item = header?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`)); return item ? decodeURIComponent(item.slice(name.length + 1)) : ''; }
export async function signSession(payload: Record<string, unknown>) { const body = encodePart(payload); return `${body}.${await hmac(body)}`; }
export async function verifySession(raw: string) { const [body, signature] = raw.split('.'); if (!body || !signature || !sessionSecret) return null; const expected = await hmac(body); if (expected !== signature) return null; const payload = decodePart(body) as { exp?: number }; if (!payload.exp || payload.exp < Date.now() / 1000) return null; return payload; }

export async function authorizationURL(state: string, nonce: string, redirectURL: string) { const discovery = await fetch(`${issuer}/.well-known/openid-configuration`).then(response => response.json() as Promise<{ authorization_endpoint: string }>); const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectURL, scope: 'openid profile email', state, nonce }); return `${discovery.authorization_endpoint}?${query}`; }
export async function exchange(code: string, redirectURL: string) { const discovery = await fetch(`${issuer}/.well-known/openid-configuration`).then(response => response.json() as Promise<{ token_endpoint: string }>); const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectURL, client_id: clientId, client_secret: clientSecret }); const response = await fetch(discovery.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); if (!response.ok) throw new Error('token exchange failed'); return response.json() as Promise<{ id_token: string }>; }
export async function verifyIDToken(raw: string, nonce: string) {
  const parts = raw.split('.');
  if (parts.length !== 3) throw new Error('invalid token format');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodePart(headerPart) as { kid?: string; alg?: string };
  const claims = decodePart(payloadPart) as { iss?: string; aud?: string | string[]; azp?: string; exp?: number; nbf?: number; iat?: number; nonce?: string; sub?: string; email?: string; email_verified?: boolean; preferred_username?: string; name?: string };
  // OIDC permits a string or an array, and Casdoor signs an array even for one client.
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
  const audienceValid = Array.isArray(audiences) && audiences.every(aud => typeof aud === 'string') && audiences.includes(clientId);
  const partyValid = claims.azp === undefined ? (audiences?.length === 1) : claims.azp === clientId;
  const now = Date.now() / 1000;
  const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (header.alg !== 'RS256' || claims.iss !== issuer || !audienceValid || !partyValid || !nonce || claims.nonce !== nonce || claims.email_verified !== true || !hasText(claims.email) || !hasText(claims.sub) || !validTime(claims.exp) || claims.exp <= now || (claims.nbf !== undefined && (!validTime(claims.nbf) || claims.nbf > now)) || (claims.iat !== undefined && (!validTime(claims.iat) || claims.iat > now))) throw new Error('invalid identity claims');
  const discovery = await fetch(`${issuer}/.well-known/openid-configuration`).then(response => response.json() as Promise<{ jwks_uri: string }>); const jwks = await fetch(discovery.jwks_uri).then(response => response.json() as Promise<{ keys: JsonWebKey[] }>); const key = jwks.keys.find(candidate => candidate.kid === header.kid); if (!key) throw new Error('unknown signing key'); const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']); const signature = Uint8Array.from(atob(signaturePart.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, new TextEncoder().encode(`${headerPart}.${payloadPart}`)); if (!valid) throw new Error('invalid token signature'); return claims;
}

export { issuer, clientId };
