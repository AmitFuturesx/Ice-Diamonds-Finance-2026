/**
 * GET /api/morning-drafts?days=7 — the latest expense drafts in morning, straight from their API,
 * so the invoices page can show what morning actually did with each upload
 * (10 = new / waiting for approval, 50 = failed to read, 200 = declined).
 * Read only. Same session check as the upload.
 */
import { dropToken, fail, guard, hosts, json, morningToken } from './_lib/morning.js'

const STATUS = { 10: 'new', 50: 'failed', 200: 'declined' }

export async function GET(request) {
  try {
    const denied = await guard(request)
    if (denied) return denied
    const days = Math.min(60, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 7))
    const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

    const token = await morningToken()
    const r = await fetch(`${hosts().api}/expenses/drafts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate: from, toDate: to, page: 1, pageSize: 50 })
    })
    if (r.status === 401) dropToken()
    const body = await r.json().catch(() => null)
    if (!r.ok || !body) {
      console.error('morning drafts search failed', r.status, JSON.stringify(body).slice(0, 300))
      return fail(502, `לא הצלחתי לקרוא את הטיוטות ממורנינג (${r.status})`)
    }
    const items = (body.items || []).map((d) => ({
      id: d.id,
      status: STATUS[d.status] || String(d.status),
      created: d.creationDate ? new Date(d.creationDate * 1000).toISOString() : null,
      updated: d.lastUpdateDate ? new Date(d.lastUpdateDate * 1000).toISOString() : null,
      supplier: d.expense?.supplier?.name || null,
      amount: d.expense?.amount ?? null,
      date: d.expense?.date || null,
      period: d.reportingPeriod || null
    }))
    return json(200, { ok: true, total: body.total ?? items.length, items })
  } catch (err) {
    console.error('morning-drafts error', err?.message)
    return fail(500, err?.message && /[֐-׿]/.test(err.message) ? err.message : 'שגיאה בקריאה ממורנינג')
  }
}
