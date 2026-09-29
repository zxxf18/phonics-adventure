import { parseCookie } from './auth/oidc';

type Identity = { sub?: unknown; display_name?: unknown; username?: unknown; email?: unknown };

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Best-effort server-side enrichment; no stats secret reaches the browser. */
export async function enrichStatsIdentity(request: Request, identity: Identity) {
  const endpoint = process.env.PHONICS_STATS_INTERNAL_URL?.trim();
  const service = (process.env.PHONICS_STATS_SERVICE || 'phonics').trim();
  const secret = process.env.PHONICS_STATS_SECRET || '';
  const visitorID = parseCookie(request.headers.get('cookie'), `ystats_vid_${service}`);
  const userID = typeof identity.sub === 'string' ? identity.sub.trim() : '';
  const userName = typeof identity.display_name === 'string' ? identity.display_name.trim() : typeof identity.username === 'string' ? identity.username.trim() : typeof identity.email === 'string' ? identity.email.trim() : '';
  if (!endpoint || !service || secret.length < 16 || !visitorID || !userID) return;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const canonical = [service, visitorID, userID, userName, timestamp].join('\n');
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical)));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Stats-Service': service, 'X-Stats-Timestamp': timestamp, 'X-Stats-Signature': signature },
        body: JSON.stringify({ visitorId: visitorID, userId: userID, userName }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Metrics enrichment must never make login or page rendering fail.
  }
}
