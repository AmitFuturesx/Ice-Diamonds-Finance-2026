/* Invoice uploads (→ morning expense draft), shared by the pages that attach an invoice to a payment.
   useInvoiceRows() loads the ✓/✗ list, sends files one at a time and remembers which payment each belongs to. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { dbService } from '../lib/supabase'

export const MAX_BYTES = 4 * 1024 * 1024
export const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const STALE_MS = 3 * 60 * 1000 // a "sending" row older than this never finished
const RANK = { sent: 0, pending: 1, skipped: 2, failed: 3 } // which row speaks for a payment

export const sizeLabel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`)
export const stateOf = (r) => (r.status === 'pending' && Date.now() - new Date(r.created_at).getTime() > STALE_MS ? 'failed' : r.status)
export const itemKey = (kind, id) => `${kind}:${id}`

/** Phone photos are often 3–8MB: shrink big JPEG/PNG/WebP to ~2200px so they pass the 4MB limit. */
export async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/**
 * rows: every upload row · invoiceFor(monthId, kind, id) → the row that speaks for that payment (or null)
 * upload(file, item) where item = { monthId, kind, id, name } · retry(row) · pick(item) opens a file picker
 * Render {picker} once in the page.
 */
export function useInvoiceRows({ notify, userEmail }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const files = useRef(new Map())
  const queue = useRef(Promise.resolve())
  const inputRef = useRef(null)
  const target = useRef(null)

  useEffect(() => {
    let alive = true
    dbService
      .getInvoiceUploads()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setLoadError('לא הצלחתי לטעון את רשימת החשבוניות.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const patchRow = (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const send = useCallback(
    (row, file) => {
      queue.current = queue.current.then(async () => {
        patchRow(row.id, { status: 'pending', error: null, created_at: new Date().toISOString() })
        const res = await dbService.sendInvoiceToMorning(file)
        const patch = res.ok ? { status: 'sent', error: null, morning_key: res.key || null } : { status: 'failed', error: res.error || 'השליחה נכשלה' }
        patchRow(row.id, patch)
        try {
          await dbService.saveInvoiceUpload({ id: row.id, file_name: row.file_name, ...patch })
        } catch {
          /* bookkeeping only */
        }
        if (res.ok) files.current.delete(row.id)
        const who = row.item_name ? ` (${row.item_name})` : ''
        notify?.(res.ok ? `החשבונית נשלחה למורנינג${who}` : `החשבונית לא נשלחה${who} · ${patch.error}`, { tone: res.ok ? 'success' : 'error', duration: res.ok ? 4000 : 8000 })
      })
      return queue.current
    },
    [notify]
  )

  const upload = async (original, item) => {
    const file = await shrinkImage(original)
    const bad = !TYPES.includes(file.type) ? 'אפשר להעלות PDF או תמונה (JPG / PNG)' : file.size > MAX_BYTES ? `הקובץ גדול מ-4MB (${sizeLabel(file.size)})` : null
    const link = item ? { month_id: item.monthId, item_kind: item.kind, item_id: String(item.id), item_name: item.name } : {}
    let row
    try {
      row = await dbService.saveInvoiceUpload({ file_name: original.name, file_size: file.size, file_type: file.type, status: bad ? 'failed' : 'pending', error: bad, uploaded_by: userEmail || null, ...link })
    } catch {
      notify?.('לא הצלחתי לרשום את החשבונית. צריך להריץ את פקודת ה-SQL של החשבוניות.', { tone: 'error', duration: 9000 })
      return
    }
    setRows((r) => [row, ...r])
    if (bad) {
      notify?.(`${original.name}: ${bad}`, { tone: 'error', duration: 8000 })
      return
    }
    files.current.set(row.id, file)
    send(row, file)
  }

  const pick = (item) => {
    target.current = { item }
    inputRef.current?.click()
  }
  const retry = (row) => {
    const file = files.current.get(row.id)
    if (file) return send(row, file)
    target.current = { retryRow: row }
    inputRef.current?.click()
    return undefined
  }
  const onPicked = async (e) => {
    const list = e.target.files ? [...e.target.files] : []
    e.target.value = ''
    const t = target.current
    target.current = null
    if (!list.length || !t) return
    if (t.item) {
      for (const f of list) await upload(f, t.item)
      return
    }
    const file = await shrinkImage(list[0])
    files.current.set(t.retryRow.id, file)
    patchRow(t.retryRow.id, { file_name: list[0].name })
    send({ ...t.retryRow, file_name: list[0].name }, file)
  }

  const invoiceFor = (monthId, kind, id) => {
    let best = null
    for (const r of rows) {
      if (r.month_id !== monthId || r.item_kind !== kind || String(r.item_id) !== String(id)) continue
      const s = stateOf(r)
      if (!best || RANK[s] < RANK[stateOf(best)]) best = r
    }
    return best ? { ...best, state: stateOf(best) } : null
  }

  const picker = <input ref={inputRef} type="file" accept="application/pdf,image/*" hidden onChange={onPicked} />
  return { rows, setRows, loading, loadError, upload, pick, retry, invoiceFor, picker }
}
