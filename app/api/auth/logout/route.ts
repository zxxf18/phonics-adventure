import { clearSessionCookie } from '../../../auth/oidc';
export async function POST() { return new Response(null, { status: 204, headers: { 'Set-Cookie': clearSessionCookie() } }); }
