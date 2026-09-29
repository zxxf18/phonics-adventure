import { parseCookie, verifySession } from '../../../auth/oidc';
import { enrichStatsIdentity } from '../../../stats-client';
export async function GET(request: Request) { const value = await verifySession(parseCookie(request.headers.get('cookie'), 'phonics_session')); if (!value) return Response.json({ error: 'unauthorized' }, { status: 401 }); await enrichStatsIdentity(request, value); return Response.json(value); }
