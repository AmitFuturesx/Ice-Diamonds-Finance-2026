/**
 * POST /api/morning-upload  — Vercel serverless function (Node runtime).
 *
 * Sends one invoice/receipt file to morning (Green Invoice) as a new expense draft.
 * The morning API key never reaches the browser: it lives only in Vercel env vars.
 *
 * Request:  multipart/form-data with `file`, and `Authorization: Bearer <supabase access token>`.
 * Response: { ok: true, key } on success, { ok: false, error } otherwise (Hebrew message).
 *
 * Env (Vercel → Project → Settings → Environment Variables):
 *   MORNING_CLIENT_ID, MORNING_CLIENT_SECRET   morning API key (Developer tools → API)
 *   MORNING_ENV                                 "production" (default) or "sandbox"
 *   MORNING_ALLOWED_EMAILS                      optional, comma separated: only these users may upload
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   already set for the app; used to check the session
 *
 * morning flow (developers.morning.co/api):
 *   1. POST {idp}/idp/v1/oauth/token  (client_credentials)        → accessToken, valid 1 hour
 *   2. GET  {api}/file-upload/v1/url?context=expense&data={"source":5} → pre-signed S3 POST, valid 60 s
 *   3. POST the file to that S3 url with every returned field      → morning creates an expense draft
 */

const HOSTS = {
  production: { idp: 'https://api.morning.co', upload: 'https://api.morning.co' },
  sandbox: { idp: 'https://api.sandbox.morning.dev', upload: 'https://api.sandbox.d.greeninvoice.co.il' }
}
const MAX_BYTES = 4 * 1024 * 1024 // Vercel caps a request body at 4.5 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/** Reused while the function instance stays warm. */
let cachedToken = null // { value, expiresAt (ms) }

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
const fail = (status, error) => json(status, { ok: false, error })

/** The caller must be signed in to the app (same Supabase project). Returns the user's email or null. */
async function sessionEmail(request) {
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

async function morningToken(hosts) {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value
  const r = await fetch(`${hosts.idp}/idp/v1/oauth/token`, {
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

/** S3 keys come from the file name; keep it plain ASCII so nothing breaks on the way. */
function safeName(name, type) {
  const ext = (String(name).match(/\.([a-z0-9]{1,5})$/i)?.[1] || (type === 'application/pdf' ? 'pdf' : type.split('/')[1] || 'bin')).toLowerCase()
  const base = String(name)
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${Date.now()}-${base || 'invoice'}.${ext}`
}

export async function POST(request) {
  try {
    if (!process.env.MORNING_CLIENT_ID || !process.env.MORNING_CLIENT_SECRET) return fail(503, 'החיבור למורנינג עוד לא הוגדר (חסר מפתח API ב-Vercel)')

    const email = await sessionEmail(request)
    if (!email) return fail(401, 'צריך להתחבר מחדש למערכת')
    const allowed = (process.env.MORNING_ALLOWED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (allowed.length && !allowed.includes(email)) return fail(403, 'למשתמש הזה אין הרשאה להעלות חשבוניות')

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') return fail(400, 'לא התקבל קובץ')
    if (!file.size) return fail(400, 'הקובץ ריק')
    if (file.size > MAX_BYTES) return fail(413, 'הקובץ גדול מ-4MB')
    const type = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.includes(type)) return fail(415, 'אפשר להעלות PDF או תמונה (JPG / PNG)')

    const hosts = HOSTS[process.env.MORNING_ENV === 'sandbox' ? 'sandbox' : 'production']
    const token = await morningToken(hosts)

    // Step 1 — pre-signed upload (valid 60 seconds, so step 2 follows right away)
    const q = new URLSearchParams({ context: 'expense', data: JSON.stringify({ source: 5 }) })
    const u = await fetch(`${hosts.upload}/file-upload/v1/url?${q}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    if (u.status === 401) cachedToken = null
    const target = await u.json().catch(() => null)
    if (!u.ok || !target?.url || !target?.fields) return fail(502, `מורנינג לא אישרה העלאה (${u.status})`)
    if (target.maxFileSize && file.size > target.maxFileSize) return fail(413, 'הקובץ גדול מהמותר במורנינג')

    // Step 2 — the file goes to morning's storage with every signed field, file last
    const name = safeName(file.name || 'invoice', type)
    const s3 = new FormData()
    for (const [k, v] of Object.entries(target.fields)) s3.append(k, String(v))
    s3.append('file', new Blob([await file.arrayBuffer()], { type }), name)
    const put = await fetch(target.url, { method: 'POST', body: s3 })
    if (!put.ok) {
      const text = (await put.text().catch(() => '')).slice(0, 200)
      console.error('morning S3 upload failed', put.status, text)
      return fail(502, `שליחת הקובץ למורנינג נכשלה (${put.status})`)
    }
    return json(200, { ok: true, key: target.fields.key ? String(target.fields.key).replace('${filename}', name) : name })
  } catch (err) {
    console.error('morning-upload error', err?.message)
    return fail(500, err?.message && /[֐-׿]/.test(err.message) ? err.message : 'שגיאה בשליחה למורנינג, נסה שוב')
  }
}
