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
import { dropToken, fail, guard, hosts, json, morningToken } from './_lib/morning.js'

const MAX_BYTES = 4 * 1024 * 1024 // Vercel caps a request body at 4.5 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

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
    const denied = await guard(request)
    if (denied) return denied

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') return fail(400, 'לא התקבל קובץ')
    if (!file.size) return fail(400, 'הקובץ ריק')
    if (file.size > MAX_BYTES) return fail(413, 'הקובץ גדול מ-4MB')
    const type = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.includes(type)) return fail(415, 'אפשר להעלות PDF או תמונה (JPG / PNG)')

    const token = await morningToken()

    // Step 1 — pre-signed upload (valid 60 seconds, so step 2 follows right away)
    const q = new URLSearchParams({ context: 'expense', data: JSON.stringify({ source: 5 }) })
    const u = await fetch(`${hosts().upload}/file-upload/v1/url?${q}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    if (u.status === 401) dropToken()
    const target = await u.json().catch(() => null)
    if (!u.ok || !target?.url || !target?.fields) return fail(502, `מורנינג לא אישרה העלאה (${u.status})`)
    if (target.maxFileSize && file.size > target.maxFileSize) return fail(413, 'הקובץ גדול מהמותר במורנינג')

    // Step 2 — the file goes to morning's storage with every signed field, file last
    const name = safeName(file.name || 'invoice', type)
    const s3 = new FormData()
    for (const [k, v] of Object.entries(target.fields)) s3.append(k, String(v))
    s3.append('file', new Blob([await file.arrayBuffer()], { type }), name)
    const put = await fetch(target.url, { method: 'POST', body: s3 })
    const putText = (await put.text().catch(() => '')).slice(0, 300)
    console.log('morning upload', { s3Status: put.status, size: file.size, type, name })
    if (!put.ok) {
      console.error('morning S3 upload failed', put.status, putText)
      return fail(502, `שליחת הקובץ למורנינג נכשלה (${put.status})`)
    }
    return json(200, { ok: true, key: target.fields.key ? String(target.fields.key).replace('${filename}', name) : name })
  } catch (err) {
    console.error('morning-upload error', err?.message)
    return fail(500, err?.message && /[֐-׿]/.test(err.message) ? err.message : 'שגיאה בשליחה למורנינג, נסה שוב')
  }
}
