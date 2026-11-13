/* Shared helpers for the morning (Green Invoice) functions. Files under api/_lib are not routes. */

export const HOSTS = {
  production: { idp: 'https://api.morning.co', upload: 'https://api.morning.co', api: 'https://api.greeninvoice.co.il/api/v1' },
  sandbox: { idp: 'https://api.sandbox.morning.dev', upload: 'https://api.sandbox.d.greeninvoice.co.il', api: 'https://sandbox.d.greeninvoice.co.il/api/v1' }
}
export const hosts = () => HOSTS[process.env.MORNING_ENV === 'sandbox' ? 'sandbox' : 'production']
export const configured = () => Boolean(process.env.MORNING_CLIENT_ID && process.env.MORNING_CLIENT_SECRET)

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
export const fail = (status, error) => json(status, { ok: false, error })

/** The caller must be signed in to the app (same Supabase project). Returns the user's email or null. */
export async function sessionEmail(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return null
  const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const user = await r.json().catch(() => null)
  return user?.email ? String(user.email).toLowerCase() : null
}

/** Signed in + (optionally) on MORNING_ALLOWED_EMAILS. Returns a failure Response, or null when allowed. */
export async function guard(request) {
  if (!configured()) return fail(503, 'החיבור למורנינג עוד לא הוגדר (חסר מפתח API ב-Vercel)')
  const email = await sessionEmail(request)
  if (!email) return fail(401, 'צריך להתחבר מחדש למערכת')
  const allowed = (process.env.MORNING_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length && !allowed.includes(email)) return fail(403, 'למשתמש הזה אין הרשאה')
  return null
}

/** morning access token (valid 1 hour), reused while the function instance stays warm. */
let cachedToken = null
export function dropToken() {
  cachedToken = null
}
export async function morningToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value
  const r = await fetch(`${hosts().idp}/idp/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.MORNING_CLIENT_ID, client_secret: process.env.MORNING_CLIENT_SECRET })
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok || !body.accessToken) {
    const code = body.error || r.status
    const msg =
      code === 'unauthorized_client'
        ? 'המנוי במורנינג לא כולל גישת API'
        : code === 'invalid_client'
          ? 'מפתח ה-API של מורנינג שגוי או חסום'
          : code === 'invalid_grant'
            ? 'מפתח ה-API של מורנינג פג תוקף או בוטל'
            : `ההתחברות למורנינג נכשלה (${code})`
    throw new Error(msg)
  }
  cachedToken = { value: body.accessToken, expiresAt: body.expiresAt ? body.expiresAt * 1000 : Date.now() + 55 * 60_000 }
  return cachedToken.value
}
