/* חשבוניות — drop or photograph an invoice/receipt and it goes straight to morning
   as an expense draft. Below: every file sent, with ✓ (arrived) or ✗ (failed, send again). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'
import { CardHead, Empty, Kpi, Menu, PageHead, Pager, Segmented } from '../kit'
import { dbService } from '../../lib/supabase'

const PER = 12
const MAX_BYTES = 4 * 1024 * 1024
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const STALE_MS = 3 * 60 * 1000 // a "sending" row older than this never finished

const sizeLabel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`)
const when = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `היום · ${time}`
  const y = new Date(today)
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `אתמול · ${time}`
  return `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' })} · ${time}`
}
const stateOf = (r) => (r.status === 'pending' && Date.now() - new Date(r.created_at).getTime() > STALE_MS ? 'failed' : r.status)

/** Phone photos are often 3–8MB: shrink big JPEG/PNG/WebP to ~2200px so they pass the 4MB limit. */
async function shrinkImage(file) {
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

export default function Invoices({ notify, userEmail }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [drag, setDrag] = useState(false)
  const files = useRef(new Map()) // row id → File, so a failed send can be retried without picking again
  const queue = useRef(Promise.resolve())
  const pickRef = useRef(null)
  const cameraRef = useRef(null)
  const retryPick = useRef(null) // row id waiting for a re-picked file

  useEffect(() => {
    let alive = true
    dbService
      .getInvoiceUploads()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setLoadError('לא הצלחתי לטעון את רשימת החשבוניות. אם זו הפעם הראשונה, צריך להריץ את פקודת ה-SQL של החשבוניות.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const patchRow = (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  /** Send one row's file to morning and record the result. Runs one file at a time. */
  const send = useCallback((row, file) => {
    queue.current = queue.current.then(async () => {
      patchRow(row.id, { status: 'pending', error: null, created_at: new Date().toISOString() })
      const res = await dbService.sendInvoiceToMorning(file)
      const patch = res.ok ? { status: 'sent', error: null, morning_key: res.key || null } : { status: 'failed', error: res.error || 'השליחה נכשלה' }
      patchRow(row.id, patch)
      try {
        await dbService.saveInvoiceUpload({ id: row.id, file_name: row.file_name, ...patch })
      } catch {
        /* the list row is only bookkeeping; the file already reached morning (or not) */
      }
      if (res.ok) files.current.delete(row.id)
      notify?.(res.ok ? `נשלח למורנינג: ${row.file_name}` : `לא נשלח: ${row.file_name} · ${patch.error}`, { tone: res.ok ? 'success' : 'error', duration: res.ok ? 4000 : 8000 })
    })
    return queue.current
  }, [notify])

  const addFiles = async (list) => {
    const picked = [...list]
    if (!picked.length) return
    for (const original of picked) {
      const file = await shrinkImage(original)
      const bad = !TYPES.includes(file.type) ? 'אפשר להעלות PDF או תמונה (JPG / PNG)' : file.size > MAX_BYTES ? `הקובץ גדול מ-4MB (${sizeLabel(file.size)})` : null
      let row
      try {
        row = await dbService.saveInvoiceUpload({ file_name: original.name, file_size: file.size, file_type: file.type, status: bad ? 'failed' : 'pending', error: bad, uploaded_by: userEmail || null })
      } catch {
        notify?.('לא הצלחתי לרשום את הקובץ ברשימה. צריך להריץ את פקודת ה-SQL של החשבוניות.', { tone: 'error', duration: 9000 })
        return
      }
      setRows((r) => [row, ...r])
      setFilter('all')
      setPage(1)
      if (bad) {
        notify?.(`${original.name}: ${bad}`, { tone: 'error', duration: 8000 })
        continue
      }
      files.current.set(row.id, file)
      send(row, file)
    }
  }

  const retry = (r) => {
    const file = files.current.get(r.id)
    if (file) return send(r, file)
    retryPick.current = r.id // the file is no longer in memory (page was reloaded): pick it again
    pickRef.current?.click()
    return undefined
  }
  const onPicked = async (e) => {
    const list = e.target.files
    const target = retryPick.current
    retryPick.current = null
    if (target && list?.length === 1) {
      const row = rows.find((x) => x.id === target)
      const file = await shrinkImage(list[0])
      if (row) {
        files.current.set(row.id, file)
        send({ ...row, file_name: list[0].name }, file)
      }
    } else if (list) addFiles(list)
    e.target.value = ''
  }
  const remove = async (r) => {
    setRows((list) => list.filter((x) => x.id !== r.id))
    files.current.delete(r.id)
    try {
      await dbService.deleteInvoiceUpload(r.id)
    } catch {
      notify?.('ההסרה מהרשימה נכשלה', { tone: 'error' })
    }
  }

  const view = rows.map((r) => ({ ...r, state: stateOf(r) }))
  const counts = { all: view.length, sent: view.filter((r) => r.state === 'sent').length, failed: view.filter((r) => r.state === 'failed').length, pending: view.filter((r) => r.state === 'pending').length }
  const shown = useMemo(() => view.filter((r) => filter === 'all' || r.state === filter), [rows, filter]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(shown.length / PER))
  const cur = Math.min(page, pages)
  const pageRows = shown.slice((cur - 1) * PER, cur * PER)
  const thisMonth = view.filter((r) => {
    const d = new Date(r.created_at)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && r.state === 'sent'
  }).length

  return (
    <div className="page ice-inv">
      <PageHead
        title="חשבוניות"
        sub={
          <>
            כל קובץ שעולה כאן נשלח ל<b>מורנינג</b> כטיוטת הוצאה, ומחכה שם לאישור
          </>
        }
      />

      <div className="ice-inv-top">
        {/* ---------- upload block ---------- */}
        <section
          className={`card ice-drop card-in ${drag ? 'is-drag' : ''}`}
          style={{ '--d': 0 }}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget) || setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            addFiles(e.dataTransfer.files)
          }}
        >
          <span className="ice-drop-ic">
            <Icon name="upload" />
          </span>
          <h2>העלאת חשבונית</h2>
          <p>גרור לכאן חשבוניות וקבלות, או בחר קבצים. אפשר כמה ביחד.</p>
          <div className="ice-drop-actions">
            <button type="button" className="btn btn--primary" onClick={() => pickRef.current?.click()}>
              <Icon name="file" /> בחירת קבצים
            </button>
            <button type="button" className="btn btn--white ice-cam" onClick={() => cameraRef.current?.click()}>
              <Icon name="smartphone" /> צילום חשבונית
            </button>
          </div>
          <small>PDF, JPG או PNG · עד 4MB לקובץ · תמונות גדולות מוקטנות אוטומטית</small>
          <input ref={pickRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={onPicked} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPicked} />
        </section>

        <div className="ice-inv-kpis">
          <Kpi icon="check" label="נשלחו החודש" value={thisMonth} format="num" tone="green" d={1} foot="מחכות לאישור במורנינג" />
          <Kpi icon="x" label="נכשלו" value={counts.failed} format="num" tone="orange" d={2} foot={counts.failed ? 'לחץ "שלח שוב" ברשימה' : 'הכל הגיע'} onClick={counts.failed ? () => setFilter('failed') : undefined} active={filter === 'failed'} />
        </div>
      </div>

      {/* ---------- what was sent ---------- */}
      <section className="card card-pad card-in" style={{ '--d': 3 }}>
        <CardHead title="מה נשלח למורנינג" sub="✓ הגיע למורנינג · ✗ לא הגיע, אפשר לשלוח שוב" icon="inbox">
          <Segmented
            size="sm"
            label="סינון"
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setPage(1)
            }}
            options={[
              { id: 'all', label: 'הכל', count: counts.all },
              { id: 'sent', label: 'נשלחו', count: counts.sent },
              { id: 'failed', label: 'נכשלו', count: counts.failed }
            ]}
          />
        </CardHead>

        {loadError && <p className="ice-inv-alert">{loadError}</p>}

        <ul className="ice-inv-list">
          {pageRows.map((r, i) => (
            <li key={r.id} className={`ice-inv-row is-${r.state} rv`} style={{ '--i': i }}>
              <span className={`ice-inv-mark is-${r.state}`} aria-label={r.state === 'sent' ? 'נשלח' : r.state === 'failed' ? 'נכשל' : 'שולח'}>
                {r.state === 'pending' ? <span className="ice-spin" /> : <Icon name={r.state === 'sent' ? 'check' : 'x'} />}
              </span>
              <div className="ice-inv-main">
                <b title={r.file_name}>{r.file_name}</b>
                <span>
                  {when(r.created_at)}
                  {r.file_size ? ` · ${sizeLabel(r.file_size)}` : ''}
                  {r.file_type === 'application/pdf' ? ' · PDF' : String(r.file_type || '').startsWith('image/') ? ' · תמונה' : ''}
                </span>
              </div>
              <div className="ice-inv-state">
                {r.state === 'sent' && <span className="ice-inv-ok">נשלח למורנינג</span>}
                {r.state === 'pending' && <span className="ice-inv-wait">שולח...</span>}
                {r.state === 'failed' && (
                  <>
                    <span className="ice-inv-err">{r.status === 'pending' ? 'השליחה לא הושלמה' : r.error || 'השליחה נכשלה'}</span>
                    <button type="button" className="btn btn--white btn--sm" onClick={() => retry(r)}>
                      <Icon name="refresh" /> {files.current.has(r.id) ? 'שלח שוב' : 'בחר ושלח שוב'}
                    </button>
                  </>
                )}
              </div>
              <span className="ice-inv-menu">
                <Menu items={[{ id: 'del', label: 'הסרה מהרשימה', icon: 'trash', danger: true, onClick: () => remove(r) }]} />
              </span>
            </li>
          ))}
        </ul>
        {!loading && pageRows.length === 0 && !loadError && (
          <Empty icon="inbox" title={rows.length ? 'אין כאן קבצים' : 'עוד לא נשלחו חשבוניות'} text={rows.length ? 'נסה סינון אחר.' : 'גרור חשבונית לבלוק למעלה והיא תישלח למורנינג.'} />
        )}
        {loading && <p className="empty">טוען...</p>}
        <Pager page={cur} pages={pages} onChange={setPage} total={shown.length} label="קבצים" />
        <p className="ice-inv-note">ההסרה מהרשימה לא מוחקת כלום במורנינג. את הטיוטות מאשרים או מוחקים בתוך מורנינג, תחת הוצאות ← טיוטות.</p>
      </section>
    </div>
  )
}
