/* חשבוניות —
   1. "חשבוניות החודש": every payment of the open month, and whether its invoice arrived
      (upload it right there → morning draft, or mark "no invoice needed").
   2. A free upload block for anything else (drag, pick, or photograph).
   3. "מה נשלח למורנינג": every file sent, with ✓ (arrived) or ✗ (failed, send again). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'
import { CardHead, Empty, Kpi, Menu, PageHead, Pager, Segmented } from '../kit'
import { ils } from '../lib'
import { dbService } from '../../lib/supabase'
import { CAT, CATS, DAY_LABEL, DAY_ORDER, buildPayments } from '../payments'
import { Modal, MonthBar } from './common'

const PER = 12
const MAX_BYTES = 4 * 1024 * 1024
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const STALE_MS = 3 * 60 * 1000 // a "sending" row older than this never finished
const RANK = { sent: 0, pending: 1, skipped: 2, failed: 3 } // which row speaks for a payment

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
const itemKey = (kind, id) => `${kind}:${id}`
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`

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

const DRAFT_STATE = {
  new: { label: 'ממתינה לאישור', cls: 'is-done' },
  failed: { label: 'מורנינג לא הצליחה לקרוא', cls: 'is-failed' },
  declined: { label: 'נדחתה', cls: 'is-failed' }
}

/** What morning actually holds: the latest expense drafts and their status, straight from its API. */
function MorningCheck() {
  const [state, setState] = useState({ loading: false, error: '', items: null })
  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    const res = await dbService.getMorningDrafts(7)
    setState({ loading: false, error: res.ok ? '' : res.error || 'הבדיקה נכשלה', items: res.ok ? res.items || [] : null })
  }
  return (
    <section className="card card-pad card-in" style={{ '--d': 6 }}>
      <CardHead title="מה מורנינג קיבלה" sub="הטיוטות האחרונות כפי שהן במורנינג, משבוע אחרון" icon="refresh">
        <button type="button" className="btn btn--white btn--sm" onClick={load} disabled={state.loading}>
          <Icon name="refresh" /> {state.loading ? 'בודק...' : state.items ? 'רענון' : 'בדיקה מול מורנינג'}
        </button>
      </CardHead>
      {state.error && <p className="ice-inv-alert">{state.error}</p>}
      {state.items && state.items.length === 0 && <p className="ice-inv-note">אין טיוטות הוצאה במורנינג מהשבוע האחרון.</p>}
      {state.items && state.items.length > 0 && (
        <ul className="ice-need-list">
          {state.items.map((d) => {
            const st = DRAFT_STATE[d.status] || { label: `סטטוס ${d.status}`, cls: 'is-skipped' }
            return (
              <li key={d.id} className="ice-need-row ice-draft-row">
                <span className="ice-need-ic" style={{ '--tone': '#2c6d85' }}>
                  <Icon name="file" />
                </span>
                <div className="ice-need-main">
                  <p className="ice-pop-name">
                    <b>{d.supplier || 'ספק עוד לא זוהה'}</b>
                    {d.amount != null && <span className="ice-pop-amt">{ils(d.amount)}</span>}
                  </p>
                  <span className="ice-pop-where">{d.created ? `הועלתה ${when(d.created)}` : ''}</span>
                </div>
                <div className="ice-need-state">
                  <span className={`ice-need-badge ${st.cls}`}>{st.label}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function Invoices(props) {
  const {
    notify,
    userEmail,
    fixedExpenses = [],
    variableExpenses = [],
    debts = [],
    deliveries = [],
    employees = [],
    employeeMonths = [],
    months = [],
    activeMonthId,
    onChangeMonth,
    onAddMonth
  } = props

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [need, setNeed] = useState('missing')
  const [groupOpen, setGroupOpen] = useState(null)
  const [catTab, setCatTab] = useState('all')
  const [page, setPage] = useState(1)
  const [drag, setDrag] = useState(false)
  const files = useRef(new Map()) // row id → File, so a failed send can be retried without picking again
  const queue = useRef(Promise.resolve())
  const pickRef = useRef(null)
  const cameraRef = useRef(null)
  const itemPickRef = useRef(null)
  const pickTarget = useRef(null) // { item } or { retryRowId }

  useEffect(() => {
    let alive = true
    dbService
      .getInvoiceUploads()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setLoadError('לא הצלחתי לטעון את רשימת החשבוניות. צריך להריץ את פקודת ה-SQL של החשבוניות.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  /* ---------- this month's payments and their invoice ---------- */
  const empMonthById = useMemo(() => Object.fromEntries(employeeMonths.map((m) => [m.employee_id, m])), [employeeMonths])
  const payments = useMemo(
    () => buildPayments({ fixedExpenses, variableExpenses, employees, empMonthById, debts, deliveries }).filter((p) => p.amount > 0),
    [fixedExpenses, variableExpenses, employees, empMonthById, debts, deliveries]
  )
  const view = rows.map((r) => ({ ...r, state: stateOf(r) }))
  const byItem = useMemo(() => {
    const m = {}
    for (const r of view) {
      if (r.month_id !== activeMonthId || !r.item_kind || !r.item_id) continue
      const k = itemKey(r.item_kind, r.item_id)
      if (!m[k] || RANK[r.state] < RANK[m[k].state]) m[k] = r
    }
    return m
  }, [rows, activeMonthId]) // eslint-disable-line react-hooks/exhaustive-deps
  const withInvoice = payments.map((p) => {
    const r = byItem[itemKey(p.cat, p.id)]
    const inv = !r ? 'missing' : r.state === 'sent' ? 'done' : r.state === 'skipped' ? 'skipped' : r.state === 'pending' ? 'pending' : 'failed'
    return { ...p, inv, row: r }
  })
  const missing = withInvoice.filter((p) => p.inv === 'missing' || p.inv === 'failed')
  const done = withInvoice.filter((p) => p.inv === 'done')
  const skipped = withInvoice.filter((p) => p.inv === 'skipped')
  // several purchases from one variable supplier → one clickable row (details + uploads in a popup)
  const supKey = (p) => String(p.raw?.supplier_id || p.name).trim()
  const bySupplier = {}
  for (const p of withInvoice) if (p.cat === 'variable') (bySupplier[supKey(p)] ||= []).push(p)
  const rollup = (items) => (items.some((x) => x.inv === 'missing' || x.inv === 'failed') ? 'missing' : items.some((x) => x.inv === 'pending') ? 'pending' : items.every((x) => x.inv === 'skipped') ? 'skipped' : 'done')
  const groups = Object.entries(bySupplier)
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      uid: `vg${key}`,
      key,
      group: true,
      cat: 'variable',
      name: items[0].name,
      amount: items.reduce((a, x) => a + x.amount, 0),
      dayKey: items[0].dayKey,
      items: [...items].sort((a, b) => String(a.raw?.date || '').localeCompare(String(b.raw?.date || ''))),
      inv: rollup(items),
      openN: items.filter((x) => x.inv === 'missing' || x.inv === 'failed').length,
      doneN: items.filter((x) => x.inv === 'done' || x.inv === 'skipped').length
    }))
  const listItems = [...withInvoice.filter((p) => p.cat !== 'variable' || bySupplier[supKey(p)].length === 1), ...groups]
  const openGroup = groups.find((g) => g.key === groupOpen)
  const isClosed = (x) => x.inv === 'done' || x.inv === 'skipped'
  const inCat = (x) => catTab === 'all' || x.cat === catTab
  const catTabs = [
    { id: 'all', label: 'הכל', open: withInvoice.filter((x) => !isClosed(x)).length },
    ...CATS.filter((c) => withInvoice.some((x) => x.cat === c.id)).map((c) => ({ id: c.id, label: c.title, icon: c.icon, tone: c.tone, open: withInvoice.filter((x) => x.cat === c.id && !isClosed(x)).length }))
  ]
  const tabBase = withInvoice.filter(inCat)
  const needList = listItems
    .filter(inCat)
    .filter((p) => (need === 'missing' ? !isClosed(p) : need === 'done' ? isClosed(p) : true))
    .sort(
      (a, b) =>
        CATS.findIndex((c) => c.id === a.cat) - CATS.findIndex((c) => c.id === b.cat) ||
        Number(isClosed(a)) - Number(isClosed(b)) ||
        (DAY_ORDER[a.dayKey] ?? 4) - (DAY_ORDER[b.dayKey] ?? 4) ||
        b.amount - a.amount
    )
  const needOf = payments.length - skipped.length
  /** the invoice state of one payment, with its actions (upload / retry / skip) */
  const actionsFor = (p) => (
    <>
      <div className="ice-need-state">
        {p.inv === 'done' && (
          <>
            <span className="ice-need-badge is-done">
              <Icon name="check" /> יש חשבונית
            </span>
            <span className="ice-need-file" title={p.row.file_name}>
              {p.row.file_name}
            </span>
          </>
        )}
        {p.inv === 'pending' && (
          <span className="ice-need-badge is-pending">
            <span className="ice-spin" /> שולח למורנינג...
          </span>
        )}
        {p.inv === 'skipped' && (
          <>
            <span className="ice-need-badge is-skipped">לא צריך חשבונית</span>
            <button type="button" className="link ice-need-undo" onClick={() => removeRow(p.row)}>
              ביטול
            </button>
          </>
        )}
        {p.inv === 'failed' && (
          <>
            <span className="ice-need-badge is-failed">
              <Icon name="x" /> {p.row.error || 'השליחה נכשלה'}
            </span>
            <button type="button" className="btn btn--white btn--sm" onClick={() => retry(p.row)}>
              <Icon name="refresh" /> שלח שוב
            </button>
          </>
        )}
        {p.inv === 'missing' && (
          <>
            <span className="ice-need-badge is-missing">חסרה חשבונית</span>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => uploadFor(p)}>
              <Icon name="upload" /> העלאת חשבונית
            </button>
            <button type="button" className="link ice-need-skip" onClick={() => skip(p)} title="למשל החזר הלוואה או תשלום בלי חשבונית">
              לא צריך
            </button>
          </>
        )}
      </div>
      {p.inv === 'done' && (
        <span className="ice-inv-menu">
          <Menu items={[{ id: 'more', label: 'העלאת חשבונית נוספת', icon: 'upload', onClick: () => uploadFor(p) }]} />
        </span>
      )}
    </>
  )

  const patchRow = (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  /** Send one row's file to morning and record the result. Runs one file at a time. */
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
          /* the list row is bookkeeping only; the file already reached morning (or not) */
        }
        if (res.ok) files.current.delete(row.id)
        const who = row.item_name ? ` (${row.item_name})` : ''
        notify?.(res.ok ? `נשלח למורנינג: ${row.file_name}${who}` : `לא נשלח: ${row.file_name}${who} · ${patch.error}`, { tone: res.ok ? 'success' : 'error', duration: res.ok ? 4000 : 8000 })
      })
      return queue.current
    },
    [notify]
  )

  /** item = a payment from this month's list, or null for a loose upload */
  const addFiles = async (list, item = null) => {
    const picked = [...list]
    for (const original of picked) {
      const file = await shrinkImage(original)
      const bad = !TYPES.includes(file.type) ? 'אפשר להעלות PDF או תמונה (JPG / PNG)' : file.size > MAX_BYTES ? `הקובץ גדול מ-4MB (${sizeLabel(file.size)})` : null
      const link = item ? { month_id: activeMonthId, item_kind: item.cat, item_id: String(item.id), item_name: item.name } : {}
      let row
      try {
        row = await dbService.saveInvoiceUpload({ file_name: original.name, file_size: file.size, file_type: file.type, status: bad ? 'failed' : 'pending', error: bad, uploaded_by: userEmail || null, ...link })
      } catch {
        notify?.('לא הצלחתי לרשום את הקובץ. צריך להריץ את פקודת ה-SQL של החשבוניות.', { tone: 'error', duration: 9000 })
        return
      }
      setRows((r) => [row, ...r])
      if (!item) {
        setFilter('all')
        setPage(1)
      }
      if (bad) {
        notify?.(`${original.name}: ${bad}`, { tone: 'error', duration: 8000 })
        continue
      }
      files.current.set(row.id, file)
      send(row, file)
    }
  }

  const uploadFor = (item) => {
    pickTarget.current = { item }
    itemPickRef.current?.click()
  }
  const retry = (r) => {
    const file = files.current.get(r.id)
    if (file) return send(r, file)
    pickTarget.current = { retryRowId: r.id } // the file is no longer in memory (page was reloaded): pick it again
    itemPickRef.current?.click()
    return undefined
  }
  const onPicked = (e) => {
    const list = e.target.files ? [...e.target.files] : []
    e.target.value = ''
    if (list.length) addFiles(list)
  }
  const onItemPicked = async (e) => {
    const list = e.target.files ? [...e.target.files] : []
    e.target.value = ''
    const t = pickTarget.current
    pickTarget.current = null
    if (!list.length || !t) return
    if (t.item) return addFiles(list, t.item)
    const row = rows.find((x) => x.id === t.retryRowId)
    if (!row) return undefined
    const file = await shrinkImage(list[0])
    files.current.set(row.id, file)
    patchRow(row.id, { file_name: list[0].name })
    return send({ ...row, file_name: list[0].name }, file)
  }
  const removeRow = async (r) => {
    setRows((list) => list.filter((x) => x.id !== r.id))
    files.current.delete(r.id)
    try {
      await dbService.deleteInvoiceUpload(r.id)
    } catch {
      notify?.('ההסרה נכשלה', { tone: 'error' })
    }
  }
  const skip = async (item) => {
    try {
      const row = await dbService.saveInvoiceUpload({ file_name: 'ללא חשבונית', status: 'skipped', month_id: activeMonthId, item_kind: item.cat, item_id: String(item.id), item_name: item.name, uploaded_by: userEmail || null })
      setRows((r) => [row, ...r])
      notify?.(`${item.name}: סומן שלא צריך חשבונית`, { tone: 'success', action: { label: 'בטל', run: () => removeRow(row) } })
    } catch {
      notify?.('לא נשמר. צריך להריץ את פקודת ה-SQL של החשבוניות.', { tone: 'error', duration: 8000 })
    }
  }

  /* ---------- history list (files only) ---------- */
  const fileRows = view.filter((r) => r.status !== 'skipped')
  const counts = { all: fileRows.length, sent: fileRows.filter((r) => r.state === 'sent').length, failed: fileRows.filter((r) => r.state === 'failed').length }
  const shown = fileRows.filter((r) => filter === 'all' || r.state === filter)
  const pages = Math.max(1, Math.ceil(shown.length / PER))
  const cur = Math.min(page, pages)
  const pageRows = shown.slice((cur - 1) * PER, cur * PER)

  return (
    <div className="page ice-inv">
      <PageHead
        title="חשבוניות"
        sub={
          <>
            {payments.length ? (
              <>
                <b>{done.length}</b> מתוך <b>{needOf}</b> תשלומים החודש כבר עם חשבונית ·{' '}
              </>
            ) : null}
            כל קובץ נשלח ל<b>מורנינג</b> כטיוטת הוצאה
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
      </PageHead>

      <div className="grid-kpi ice-inv-kpis">
        <Kpi icon="clock" label="חסרה חשבונית" value={missing.length} format="num" tone="orange" d={0} foot={missing.length ? 'לחץ כדי לראות למי' : 'לכולם יש חשבונית'} onClick={() => setNeed('missing')} active={need === 'missing'} />
        <Kpi icon="check" label="יש חשבונית" value={done.length} format="num" tone="green" d={1} foot={`מתוך ${needOf} תשלומים`} onClick={() => setNeed('done')} active={need === 'done'} />
        <Kpi icon="minus" label="לא צריך חשבונית" value={skipped.length} format="num" tone="teal" d={2} foot="למשל החזר הלוואה" />
        <Kpi icon="x" label="שליחות שנכשלו" value={counts.failed} format="num" tone="purple" d={3} foot={counts.failed ? 'אפשר לשלוח שוב' : 'הכל הגיע למורנינג'} onClick={counts.failed ? () => setFilter('failed') : undefined} />
      </div>

      {/* ---------- 1. who needs an invoice this month ---------- */}
      <section className="card card-pad card-in" style={{ '--d': 4 }}>
        <CardHead title="חשבוניות החודש" sub="כל מי שצריך לשלם לו החודש · העלאת החשבונית שלו שולחת אותה למורנינג" icon="receipt">
          <Segmented
            size="sm"
            label="סינון"
            value={need}
            onChange={setNeed}
            options={[
              { id: 'missing', label: 'חסרות', count: tabBase.filter((x) => !isClosed(x)).length },
              { id: 'done', label: 'הושלמו', count: tabBase.filter(isClosed).length },
              { id: 'all', label: 'הכל', count: tabBase.length }
            ]}
          />
        </CardHead>
        <div className="ice-cat-tabs" role="tablist" aria-label="סוג תשלום">
          {catTabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={catTab === t.id} className={`ice-cat-tab ${catTab === t.id ? 'is-on' : ''}`} style={{ '--tone': t.tone || 'var(--teal)' }} onClick={() => setCatTab(t.id)}>
              {t.icon && <Icon name={t.icon} />}
              {t.label}
              <em className={t.open ? 'is-open' : ''}>{t.open || '✓'}</em>
            </button>
          ))}
        </div>
        <ul className="ice-need-list">
          {needList.map((p, i) => {
            const c = CAT[p.cat]
            const header =
              catTab === 'all' && (i === 0 || needList[i - 1].cat !== p.cat) ? (
                <li key={`h-${p.cat}`} className="ice-need-sec" style={{ '--tone': c.tone }}>
                  <Icon name={c.icon} /> {c.title}
                </li>
              ) : null
            if (p.group)
              return [
                header,
                <li key={p.uid} className={`ice-need-row is-${p.inv} is-group rv`} style={{ '--i': Math.min(i, 12), '--tone': c.tone }} role="button" tabIndex={0} onClick={() => setGroupOpen(p.key)} onKeyDown={(e) => e.key === 'Enter' && setGroupOpen(p.key)}>
                  <span className="ice-need-ic" title={c.title}>
                    <Icon name={c.icon} />
                  </span>
                  <div className="ice-need-main">
                    <p className="ice-pop-name">
                      <b>{p.name}</b>
                      <span className="ice-pop-amt">{ils(p.amount)}</span>
                    </p>
                    <span className="ice-pop-where">
                      {c.title} · {p.items.length} רכישות החודש · {p.doneN} מתוך {p.items.length} עם חשבונית
                    </span>
                  </div>
                  <div className="ice-need-state">
                    {p.openN > 0 ? (
                      <span className="ice-need-badge is-missing">{p.openN === 1 ? 'חסרה חשבונית' : `חסרות ${p.openN} חשבוניות`}</span>
                    ) : p.inv === 'pending' ? (
                      <span className="ice-need-badge is-pending">
                        <span className="ice-spin" /> שולח...
                      </span>
                    ) : (
                      <span className="ice-need-badge is-done">
                        <Icon name="check" /> כל החשבוניות
                      </span>
                    )}
                    <span className={`btn btn--sm ${p.openN ? 'btn--primary' : 'btn--white'}`}>
                      <Icon name="layers" /> {p.openN ? 'פירוט והעלאה' : 'פירוט'}
                    </span>
                  </div>
                </li>
              ]
            return [
              header,
              (
              <li key={p.uid} className={`ice-need-row is-${p.inv} rv`} style={{ '--i': Math.min(i, 12), '--tone': c.tone }}>
                <span className="ice-need-ic" title={c.title}>
                  <Icon name={c.icon} />
                </span>
                <div className="ice-need-main">
                  <p className="ice-pop-name">
                    <b>{p.name}</b>
                    <span className="ice-pop-amt">{ils(p.amount)}</span>
                  </p>
                  <span className="ice-pop-where">{[c.title, p.cat !== 'variable' && p.dayKey && p.dayKey !== 'unknown' ? DAY_LABEL[p.dayKey] : null, p.sub].filter(Boolean).join(' · ')}</span>
                </div>
                {actionsFor(p)}
              </li>
              )
            ]
          })}
        </ul>
        {needList.length === 0 && (
          <Empty
            icon={need === 'missing' ? 'check' : 'inbox'}
            title={!payments.length ? 'אין תשלומים בחודש הזה' : need === 'missing' ? 'לכל התשלומים של החודש יש חשבונית' : 'עוד אין כאן תשלומים'}
            text={!payments.length ? 'הוסף הוצאות, חובות או עובדים לחודש, והם יופיעו כאן.' : undefined}
          />
        )}
        <input ref={itemPickRef} type="file" accept="application/pdf,image/*" hidden onChange={onItemPicked} />
      </section>

      {openGroup && (
        <Modal label={openGroup.name} onClose={() => setGroupOpen(null)} className="ice-pop">
          {(close) => (
            <div className="ice-pop-in" style={{ '--tone': CAT.variable.tone }}>
              <header className="ice-pop-head">
                <span className="ice-cat-ic">
                  <Icon name={CAT.variable.icon} />
                </span>
                <div>
                  <h2>{openGroup.name}</h2>
                  <p>
                    {openGroup.items.length} רכישות החודש · סה״כ {ils(openGroup.amount)} · {openGroup.doneN} מתוך {openGroup.items.length} עם חשבונית
                  </p>
                </div>
                <button type="button" className="icon-btn icon-btn--soft ice-pop-x" onClick={close} aria-label="סגירה">
                  <Icon name="x" />
                </button>
              </header>
              <ul className="ice-need-list ice-group-list">
                {openGroup.items.map((p) => (
                  <li key={p.uid} className={`ice-need-row is-${p.inv}`} style={{ '--tone': CAT.variable.tone }}>
                    <span className="ice-need-ic">
                      <Icon name="receipt" />
                    </span>
                    <div className="ice-need-main">
                      <p className="ice-pop-name">
                        <b>{p.raw?.description || 'רכישה'}</b>
                        <span className="ice-pop-amt">{ils(p.amount)}</span>
                      </p>
                      <span className="ice-pop-where">{p.raw?.date ? `${String(p.raw.date).slice(8, 10)}/${String(p.raw.date).slice(5, 7)}` : 'בלי תאריך'}</span>
                    </div>
                    {actionsFor(p)}
                  </li>
                ))}
              </ul>
              <p className="ice-inv-note">כל רכישה מקבלת חשבונית משלה, והיא נשלחת למורנינג. רכישות חדשות מוסיפים בעמוד הוצאות משתנות.</p>
            </div>
          )}
        </Modal>
      )}

      {/* ---------- 2. loose upload ---------- */}
      <section
        className={`card ice-drop card-in ${drag ? 'is-drag' : ''}`}
        style={{ '--d': 5 }}
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
        <h2>העלאת חשבונית כללית</h2>
        <p>לחשבונית שלא שייכת לתשלום ברשימה. גרור לכאן או בחר קבצים, אפשר כמה ביחד.</p>
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

      <MorningCheck />

      {/* ---------- 3. what was sent ---------- */}
      <section className="card card-pad card-in" style={{ '--d': 6 }}>
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
                  {r.item_name ? `${r.item_name} · ` : ''}
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
                <Menu items={[{ id: 'del', label: 'הסרה מהרשימה', icon: 'trash', danger: true, onClick: () => removeRow(r) }]} />
              </span>
            </li>
          ))}
        </ul>
        {!loading && pageRows.length === 0 && !loadError && (
          <Empty icon="inbox" title={fileRows.length ? 'אין כאן קבצים' : 'עוד לא נשלחו חשבוניות'} text={fileRows.length ? 'נסה סינון אחר.' : 'העלה חשבונית לאחד התשלומים למעלה.'} />
        )}
        {loading && <p className="empty">טוען...</p>}
        <Pager page={cur} pages={pages} onChange={setPage} total={shown.length} label="קבצים" />
        <p className="ice-inv-note">
          {pl(counts.sent, 'קובץ נשלח', 'קבצים נשלחו')} עד היום. ההסרה מהרשימה לא מוחקת כלום במורנינג. את הטיוטות מאשרים או מוחקים בתוך מורנינג, תחת הוצאות ← טיוטות.
        </p>
      </section>
    </div>
  )
}
