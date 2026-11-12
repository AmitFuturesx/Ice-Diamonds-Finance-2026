/* ------------------------------------------------------------------
   לוח בקרה — the Orbit home board, fed with Ice Diamonds' month.
   Column 1: title + month, cash-flow chart, donut for the chosen billing day, export chip + peeking folder.
   Column 2: expense folders (fixed / variable), the green balance card, billing-day table.
   Column 3: search, "לשלם עכשיו" task cards, payroll rings, income by source.
------------------------------------------------------------------- */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { BarChart, Delta, Drawer, DrawerHead, Empty, Highlight, MoodPill, Segmented, Select, StatusPill, Avatar, nextMood, nextStatus } from './kit'
import { compact, ils, ilsK, monotone, num, pctChange, placePill, toArea, useCountUp, useDismiss, useEnter, useFlip, useSize, useStable, useTween } from './lib'
import { computePay } from '../lib/payroll'
import { dbService } from '../lib/supabase'

const SHORT_MONTH = ['', 'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const SOURCES = [
  { id: 'מקסימוס', short: 'מקסימוס' },
  { id: 'UPS', short: 'UPS' },
  { id: 'מזומן', short: 'מזומן' },
  { id: 'העברה בנקאית', short: 'העברה' },
  { id: 'משולם / GROW', short: 'GROW' }
]
const DAYS = [
  { key: '10', label: '10 לחודש' },
  { key: '15', label: '15 לחודש' },
  { key: '19', label: '19 לחודש' },
  { key: 'unknown', label: 'תאריך לא ידוע' }
]
const SOURCE_LABEL = { fixed: 'הוצאה קבועה', variable: 'הוצאה משתנה', debt: 'החזר חוב' }
const MOOD_RANK = { angry: 0, neutral: 1, happy: 2 }
const DAY_ORDER = { 10: 0, 15: 1, 19: 2, unknown: 3 }
const MOOD_TONE = { angry: 'peach', neutral: 'blue', happy: 'green' }
const monthLabel = (m) => (m ? (m.name.includes(String(m.year)) ? m.name : `${m.name} ${m.year}`) : '')

const bucketKey = (n) => (n == null || isNaN(n) ? 'unknown' : String([10, 15, 19].reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p))))

/* ============================================================== */
export default function Dashboard(props) {
  const {
    fixedExpenses = [],
    variableExpenses = [],
    debts = [],
    incomeEntries = [],
    months = [],
    activeMonthId = '',
    onChangeMonth,
    onAddMonth,
    onExport,
    exporting,
    onSaveFixedExpense,
    onSaveVariableExpense,
    onSaveDebt,
    employees = [],
    employeeMonths = [],
    onNavigate,
    notify
  } = props

  /* ---------- this month ---------- */
  const sum = (arr, f) => arr.reduce((a, x) => a + (Number(x[f]) || 0), 0)
  const totalIncome = sum(incomeEntries, 'amount')
  const totalFixed = sum(fixedExpenses, 'amount')
  const totalVariable = sum(variableExpenses, 'amount')
  const totalDebts = sum(debts, 'monthly_payment')
  const totalExpenses = totalFixed + totalVariable + totalDebts
  const net = totalIncome - totalExpenses

  const obligations = useMemo(
    () => [
      ...fixedExpenses.map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) || 0, status: e.status, dayKey: bucketKey(e.payment_date ? parseInt(e.payment_date, 10) : NaN), source: 'fixed', mood: e.mood || 'happy', item: e })),
      ...variableExpenses.map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) || 0, status: e.status, dayKey: bucketKey(e.date ? parseInt(e.date.split('-')[2], 10) : NaN), source: 'variable', mood: e.mood || 'happy', item: e })),
      ...debts.map((d) => ({ id: d.id, name: d.name, amount: Number(d.monthly_payment) || 0, status: d.status || 'לא שולם', dayKey: bucketKey(d.payment_date ? parseInt(String(d.payment_date).split('-').pop(), 10) : NaN), source: 'debt', mood: d.mood || 'happy', item: d }))
    ],
    [fixedExpenses, variableExpenses, debts]
  )
  const save = useCallback(
    (o, patch) => {
      if (o.source === 'fixed') onSaveFixedExpense?.({ ...o.item, ...patch })
      if (o.source === 'variable') onSaveVariableExpense?.({ ...o.item, ...patch })
      if (o.source === 'debt') onSaveDebt?.({ ...o.item, ...patch })
    },
    [onSaveFixedExpense, onSaveVariableExpense, onSaveDebt]
  )
  const markPaid = (o) => {
    const prev = o.status
    save(o, { status: 'שולם' })
    notify?.(`סומן כשולם: ${o.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => save(o, { status: prev }) } })
  }

  const days = DAYS.map((d) => {
    const items = obligations.filter((o) => o.dayKey === d.key)
    const total = items.reduce((a, o) => a + o.amount, 0)
    const left = items.filter((o) => o.status !== 'שולם').reduce((a, o) => a + o.amount, 0)
    return { ...d, items, total, left, paid: total - left, open: items.filter((o) => o.status !== 'שולם').length }
  })

  /* ---------- history ---------- */
  const sorted = useMemo(() => [...months].sort((a, b) => a.year - b.year || a.month_number - b.month_number), [months])
  const activeIdx = sorted.findIndex((m) => m.id === activeMonthId)
  const activeMonth = sorted[activeIdx]
  const window12 = useMemo(() => (activeIdx >= 0 ? sorted.slice(Math.max(0, activeIdx - 11), activeIdx + 1) : []), [sorted, activeIdx])
  const idsKey = window12.map((m) => m.id).join(',')
  const [hist, setHist] = useState({})
  useEffect(() => {
    if (!idsKey) return undefined
    let alive = true
    dbService
      .getMonthTotals(idsKey.split(','))
      .then((r) => alive && setHist(r))
      .catch(() => alive && setHist({}))
    return () => {
      alive = false
    }
  }, [idsKey])
  const series = window12.map((m) => {
    const t = m.id === activeMonthId ? { income: totalIncome, fixed: totalFixed, variable: totalVariable, debts: totalDebts } : hist[m.id] || { income: 0, fixed: 0, variable: 0, debts: 0 }
    const exp = t.fixed + t.variable + t.debts
    return { m, label: SHORT_MONTH[m.month_number] || m.name, income: t.income, expenses: exp, net: t.income - exp }
  })
  const prev = series.length > 1 ? series[series.length - 2] : null

  /* ---------- search ---------- */
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  /* ---------- drawers ---------- */
  const [drawer, setDrawer] = useState(null) // { title, sub, items }
  const [selectedDay, setSelectedDay] = useState(() => (days.find((d) => d.left > 0) || days[0]).key)
  const day = days.find((d) => d.key === selectedDay) || days[0]
  const openDay = (d) => setDrawer({ kind: 'day', key: d.key })
  const drawerItems = drawer
    ? drawer.kind === 'day'
      ? obligations.filter((o) => o.dayKey === drawer.key).sort((a, b) => Number(a.status === 'שולם') - Number(b.status === 'שולם') || b.amount - a.amount)
      : obligations.filter((o) => o.source === drawer.key).sort((a, b) => Number(a.status === 'שולם') - Number(b.status === 'שולם') || DAY_ORDER[a.dayKey] - DAY_ORDER[b.dayKey])
    : []

  /* ---------- folders (categories) ---------- */
  const folder = (source, title, scope, tone, page) => {
    const items = obligations.filter((o) => o.source === source)
    const total = items.reduce((a, o) => a + o.amount, 0)
    const paidN = items.filter((o) => o.status === 'שולם').length
    const left = items.filter((o) => o.status !== 'שולם').reduce((a, o) => a + o.amount, 0)
    const status = !items.length ? 'empty' : left === 0 ? 'closed' : paidN > 0 || items.some((o) => o.status === 'שולם חלקית') ? 'review' : 'pending'
    return { id: source, title, scope, tone, page, total, left, count: items.length, paidN, status }
  }
  const folders = {
    fixed: folder('fixed', 'הוצאות קבועות', 'כל חודש', 'white', 'fixed_expenses'),
    variable: folder('variable', 'הוצאות משתנות', 'החודש', 'white', 'variable_expenses'),
    debt: folder('debt', 'חובות והלוואות', 'החזרים', 'cream', 'debts')
  }

  /* ---------- payroll ---------- */
  const empMonthById = {}
  employeeMonths.forEach((m) => (empMonthById[m.employee_id] = m))
  const payroll = employees
    .filter((e) => e.active !== false)
    .map((e) => ({ emp: e, total: computePay(e, empMonthById[e.id], employees, empMonthById).total, status: empMonthById[e.id]?.status || 'לא שולם' }))
    .sort((a, b) => b.total - a.total)
  const payrollTotal = payroll.reduce((a, r) => a + r.total, 0)

  const monthOptions = [...sorted].reverse().map((m) => ({ id: m.id, label: monthLabel(m) }))

  return (
    <div className="board">
      {/* ---------- column 1 ---------- */}
      <div className="col col-1">
        <header className="page-head page-head--board ice-board-head">
          <h1 aria-label="לוח בקרה">
            <span className="word" aria-hidden="true">
              לוח&nbsp;
            </span>
            <span className="word" style={{ '--i': 1 }} aria-hidden="true">
              בקרה
            </span>
          </h1>
          <div className="ice-month rv" style={{ '--i': 3 }}>
            <Select value={activeMonthId} options={monthOptions} onChange={onChangeMonth} icon="calendar" label="חודש" align="end" />
            <button type="button" className="icon-btn icon-btn--soft" onClick={onAddMonth} aria-label="הוספת חודש חדש" title="הוספת חודש חדש">
              <Icon name="plus" />
            </button>
          </div>
        </header>
        <CashFlow series={series} monthName={monthLabel(activeMonth)} totalIncome={totalIncome} />
        <DayDonut day={day} />
        <div className="col-foot rise" style={{ '--d': 6 }}>
          <button className="ws-chip" onClick={onExport} disabled={exporting}>
            <span className="ws-logo">
              <Icon name="download" />
            </span>
            {exporting ? 'מייצא...' : `ייצוא ${monthLabel(activeMonth)} לאקסל`}
          </button>
          <button className="peek" onClick={() => setDrawer({ kind: 'source', key: 'debt' })} aria-label="פתיחת חובות והלוואות">
            <Folder f={folders.debt} />
          </button>
        </div>
      </div>

      {/* ---------- column 2 ---------- */}
      <div className="col col-2">
        <div className="files sect rise" id="sec-files" style={{ '--d': 1 }}>
          {[0, 1].map((slot) => (
            <span key={slot} className={`slot ${slot === 1 ? 'is-open' : ''}`} style={{ '--x': slot }} aria-hidden="true" />
          ))}
          {[folders.fixed, folders.variable].map((f, slot) => (
            <Folder
              key={f.id}
              f={f}
              className={slot === 1 ? 'is-lifted' : ''}
              style={{ '--x': slot }}
              role="button"
              tabIndex={0}
              onClick={() => setDrawer({ kind: 'source', key: f.id })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDrawer({ kind: 'source', key: f.id })}
            />
          ))}
        </div>
        <Balance series={series} net={net} income={totalIncome} expenses={totalExpenses} monthName={monthLabel(activeMonth)} onExport={onExport} />
        <DaysTable days={days} selected={selectedDay} onSelect={setSelectedDay} onOpen={openDay} query={q} />
      </div>

      {/* ---------- column 3 ---------- */}
      <div className="col col-3">
        <div className="search rise" style={{ '--d': 1 }}>
          <Icon name="search" />
          <input value={query} placeholder="חיפוש ספק או תשלום" aria-label="חיפוש ספק או תשלום" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
          {query ? (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="ניקוי חיפוש">
              <Icon name="x" />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        <PayNow obligations={obligations} query={q} onToggle={(o) => (o.status === 'שולם' ? save(o, { status: 'לא שולם' }) : markPaid(o))} onMood={(o) => save(o, { mood: nextMood(o.mood) })} />
        <Payroll rows={payroll} total={payrollTotal} onOpen={() => onNavigate?.('employees')} />
        <IncomeFlow incomeEntries={incomeEntries} total={totalIncome} prevIncome={prev?.income} onOpen={() => onNavigate?.('income')} />
      </div>

      {drawer && (
        <Drawer label="פירוט תשלומים" onClose={() => setDrawer(null)}>
          {(close) => {
            const total = drawerItems.reduce((a, o) => a + o.amount, 0)
            const left = drawerItems.filter((o) => o.status !== 'שולם').reduce((a, o) => a + o.amount, 0)
            const title = drawer.kind === 'day' ? `תשלומים · ${DAYS.find((d) => d.key === drawer.key)?.label}` : folders[drawer.key]?.title
            const page = drawer.kind === 'source' ? folders[drawer.key]?.page : null
            return (
              <>
                <DrawerHead icon={drawer.kind === 'day' ? 'calendar' : 'folder'} title={title} sub={`${drawerItems.length} פריטים · סה״כ ${ils(total)} · נותר ${ils(left)}`} close={close} />
                <ul className="ob-list">
                  {drawerItems.map((o, i) => (
                    <li key={o.source + o.id} className={`ob-row rv ${o.status === 'שולם' ? 'is-paid' : ''}`} style={{ '--i': i }}>
                      <div className="ob-main">
                        <b>{o.name}</b>
                        <span>
                          {SOURCE_LABEL[o.source]}
                          {drawer.kind === 'source' ? ` · ${DAYS.find((d) => d.key === o.dayKey)?.label}` : ''}
                        </span>
                      </div>
                      <b className="ob-amount">{ils(o.amount)}</b>
                      <div className="ob-pills">
                        <StatusPill status={o.status} onClick={() => save(o, { status: nextStatus(o.status) })} />
                        <MoodPill mood={o.mood} onClick={() => save(o, { mood: nextMood(o.mood) })} />
                      </div>
                    </li>
                  ))}
                  {drawerItems.length === 0 && <Empty icon="check" title="אין תשלומים כאן" />}
                </ul>
                <p className="ob-hint">לחיצה על הסטטוס מחליפה אותו · לחיצה על הפרצוף מעדכנת כמה הספק לחוץ</p>
                {page && (
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => {
                      close()
                      onNavigate?.(page)
                    }}
                  >
                    לעמוד {title}
                    <Icon name="arrowRight" className="ob-arrow" />
                  </button>
                )}
              </>
            )
          }}
        </Drawer>
      )}
    </div>
  )
}

/* ============================================================== */
/* Folder card (template's FileCard)                                */
function Folder({ f, className = '', style, ...rest }) {
  const BADGE = { pending: 'לא שולם', review: 'שולם חלקית', closed: 'הכל שולם', empty: 'אין פריטים' }
  const pct = f.count ? (f.paidN / f.count) * 100 : 0
  return (
    <div className={`file ${f.tone === 'cream' ? 'file--cream' : ''} ${className}`} style={style} {...rest}>
      <span className="file-tab" aria-hidden="true" />
      <div className="file-body">
        <div className="file-meta">
          <span>{f.scope}</span>
          <span className="file-access">
            <Icon name={f.id === 'debt' ? 'lock' : 'share'} />
            {f.count} פריטים
          </span>
        </div>
        <h4>{f.title}</h4>
        <p className="file-lender">{ils(f.total)} החודש</p>
        <span className={`badge badge--${f.status === 'empty' ? 'closed' : f.status}`}>{f.status === 'pending' || f.status === 'review' ? `נותר ${ils(f.left)}` : BADGE[f.status]}</span>
        <div className="file-foot">
          <span className="bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span>
            {f.paidN} מתוך {f.count} שולמו
          </span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== */
/* Cash flow (template's Tokenization chart)                        */
const RANGE_TABS = [
  { id: 3, label: '3 חודשים' },
  { id: 6, label: '6 חודשים' },
  { id: 12, label: 'שנה' }
]
const PAD_X = 14
function CashFlow({ series, monthName, totalIncome }) {
  const [range, setRange] = useState(6)
  const [mode, setMode] = useState('line')
  const [show, setShow] = useState({ income: true, expenses: true })
  const [hover, setHover] = useState(null)
  const rows = series.slice(-range)
  const data = rows.length === 1 ? [{ ...rows[0], label: '' , income: 0, expenses: 0, ghost: true }, rows[0]] : rows
  const n = data.length
  const [pin, setPin] = useState(null)
  const pinIdx = pin == null || pin >= n ? n - 1 : pin

  const inc = useTween(useStable(data.map((d) => d.income)), 750)
  const exp = useTween(useStable(data.map((d) => d.expenses)), 750)
  const domain = useMemo(() => {
    const vals = [...(show.income ? data.map((d) => d.income) : []), ...(show.expenses ? data.map((d) => d.expenses) : [])]
    const v = vals.length ? vals : [0, 1]
    const lo = Math.min(...v)
    const hi = Math.max(...v, 1)
    if (mode === 'bars') return [0, hi * 1.28]
    const pad = (hi - lo) * 0.16 || hi * 0.1
    return [lo - pad * 0.7, hi + pad * 1.6]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.map((d) => `${d.income}:${d.expenses}`).join('|'), show.income, show.expenses, mode])
  const dom = useTween(useStable(domain), 750)
  const count = useCountUp(totalIncome, 1100, useEnter(2, 150))

  const canvasRef = useRef(null)
  const { w, h } = useSize(canvasRef)
  const top = 6
  const bottom = Math.max(top + 1, h - 4)
  const x = (i) => PAD_X + (i * (w - PAD_X * 2)) / Math.max(1, n - 1)
  const y = (v) => bottom - ((v - dom[0]) / (dom[1] - dom[0] || 1)) * (bottom - top)
  const ptsI = (inc.length === n ? inc : data.map((d) => d.income)).map((v, i) => [x(i), y(v)])
  const ptsE = (exp.length === n ? exp : data.map((d) => d.expenses)).map((v, i) => [x(i), y(v)])
  const lineI = w ? monotone(ptsI) : ''
  const lineE = w ? monotone(ptsE) : ''

  const idx = hover ?? pinIdx
  const primary = show.income || !show.expenses ? 'income' : 'expenses'
  const focus = (primary === 'income' ? ptsI : ptsE)[idx] || [0, 0]
  const focusRow = data[idx] || data[n - 1] || { label: '', income: 0, expenses: 0, ghost: true }
  const pickIndex = (clientX) => {
    const r = canvasRef.current.getBoundingClientRect()
    const i = Math.round(((clientX - r.left - PAD_X) / (r.width - PAD_X * 2)) * (n - 1))
    return Math.max(0, Math.min(n - 1, i))
  }

  const tabsRef = useRef(null)
  const tabPill = useRef(null)
  useLayoutEffect(() => {
    placePill(tabPill.current, tabsRef.current?.querySelector('.is-on'))
  }, [range, w])

  return (
    <section className="tk sect rise" id="sec-cashflow" style={{ '--d': 2 }}>
      <div className="sec-head">
        <h2 className="sec-title">תזרים</h2>
        <p className="sec-sub">
          <b>{ils(Math.round(count))}</b> נכנסו ב{monthName}
        </p>
      </div>

      <div className="card tk-card">
        <div className="tk-legend" role="group" aria-label="סדרות">
          {[
            { id: 'income', label: 'הכנסות', color: 'var(--green)' },
            { id: 'expenses', label: 'הוצאות', color: 'var(--purple)' }
          ].map((s) => (
            <button
              key={s.id}
              className={`legend-btn ${show[s.id] ? '' : 'is-off'}`}
              style={{ '--c': s.color }}
              aria-pressed={show[s.id]}
              onClick={() => setShow((v) => (v[s.id] && !v[s.id === 'income' ? 'expenses' : 'income'] ? v : { ...v, [s.id]: !v[s.id] }))}
            >
              <i />
              {s.label}
            </button>
          ))}
          <span className="tk-spacer" />
          <Segmented
            size="sm"
            label="סוג גרף"
            options={[
              { id: 'line', label: 'קו', icon: 'line' },
              { id: 'bars', label: 'עמודות', icon: 'bars' }
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        <div className="tk-x" aria-hidden="true">
          {w > 0 &&
            data.map((d, i) => (
              <span key={`${range}-${d.m?.id}-${i}`} style={{ left: x(i) }} className={i === idx ? 'is-on' : ''}>
                {d.ghost ? '' : d.label}
              </span>
            ))}
        </div>

        <div
          className="tk-canvas"
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label={`תזרים: ${focusRow.label} הכנסות ${ils(focusRow.income)}, הוצאות ${ils(focusRow.expenses)}`}
          onPointerMove={(e) => setHover(pickIndex(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => setPin(pickIndex(e.clientX))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setPin(Math.min(n - 1, pinIdx + 1))
            if (e.key === 'ArrowLeft') setPin(Math.max(0, pinIdx - 1))
          }}
        >
          {w > 0 && (
            <svg width={w} height={h}>
              <defs>
                <linearGradient id="tkArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6cc06a" stopOpacity="0.26" />
                  <stop offset="1" stopColor="#6cc06a" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="tkCol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6cc06a" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#6cc06a" stopOpacity="0" />
                </linearGradient>
                <clipPath id="tkClip">
                  <rect x="0" y={top} width={w} height={bottom - top} />
                </clipPath>
              </defs>
              {[0, 0.5, 1].map((f) => (
                <line key={f} className="tk-grid" x1="0" x2={w} y1={top + f * (bottom - top)} y2={top + f * (bottom - top)} />
              ))}
              <g clipPath="url(#tkClip)">
                <g className="tk-follow" style={{ transform: `translate(${focus[0]}px, ${focus[1]}px)` }}>
                  <rect className="tk-col" x="-21" y={-(focus[1] - top) - 40} width="42" height={h + 80} rx="14" fill="url(#tkCol)" />
                  {mode === 'line' && <line className="tk-cross" x1="0" x2="0" y1="0" y2={h} />}
                </g>
              </g>
              {mode === 'line' ? (
                <>
                  {show.income && <path className="tk-area" d={toArea(lineI, ptsI, bottom)} fill="url(#tkArea)" />}
                  {show.expenses && <path className="tk-line tk-line--mbs" d={lineE} pathLength="1" />}
                  {show.income && <path className="tk-line tk-line--mort" d={lineI} pathLength="1" />}
                  {show.expenses && ptsE.map(([px, py], i) => <circle key={`e${i}`} className="tk-dot tk-dot--mbs" cx={px} cy={py} r="3.3" style={{ '--i': i }} />)}
                  {show.income && ptsI.map(([px, py], i) => <circle key={`i${i}`} className="tk-dot tk-dot--mort" cx={px} cy={py} r="3.3" style={{ '--i': i }} />)}
                  <g className="tk-follow" style={{ transform: `translate(${focus[0]}px, ${focus[1]}px)` }}>
                    <circle className="tk-halo" r="11" />
                    <circle className="tk-focus" r="5.4" />
                  </g>
                </>
              ) : (
                <g className="tk-bars">
                  {data.map((d, i) => {
                    const both = show.income && show.expenses
                    const bw = Math.max(6, Math.min(13, ((w - PAD_X * 2) / Math.max(1, n - 1)) * 0.2))
                    const bars = [
                      show.income && { id: 'i', v: inc[i] ?? d.income, c: 'var(--green)', x: both ? x(i) - bw - 2 : x(i) - bw / 2 },
                      show.expenses && { id: 'e', v: exp[i] ?? d.expenses, c: '#b56fdf', x: both ? x(i) + 2 : x(i) - bw / 2 }
                    ].filter(Boolean)
                    return (
                      <g key={`${range}-${i}`} className={`tk-bar-col ${i === idx ? 'is-on' : ''}`} style={{ '--i': i }}>
                        {bars.map((b) => (
                          <rect key={b.id} className="tk-bar" x={b.x} y={y(b.v)} width={bw} height={Math.max(0, bottom - y(b.v))} rx={bw / 2} fill={b.c} />
                        ))}
                      </g>
                    )
                  })}
                </g>
              )}
            </svg>
          )}
          {w > 0 && !focusRow.ghost && (
            <div className="tk-tip" style={{ '--x': focus[0], '--y': focus[1] }}>
              <b>{ils(primary === 'income' ? focusRow.income : focusRow.expenses)}</b>
              <span>
                {primary === 'income' ? 'הכנסות' : 'הוצאות'} · {focusRow.label}
              </span>
            </div>
          )}
        </div>

        <div className="tabs" ref={tabsRef} role="tablist" aria-label="טווח">
          <span className="tabs-pill" ref={tabPill} aria-hidden="true" />
          {RANGE_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={range === t.id}
              className={range === t.id ? 'is-on' : ''}
              onClick={() => {
                setRange(t.id)
                setPin(null)
                setHover(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================== */
/* Donut for the chosen billing day (template's PortfolioDonut)     */
const R = 66
const C = 2 * Math.PI * R
function DayDonut({ day }) {
  const [hot, setHot] = useState(null)
  const total = day.total || 1
  const share = useTween(day.total ? day.paid / total : 0, 950, 0, useEnter(4, 120))
  const left = useCountUp(day.left, 1100, useEnter(4, 150))
  const paid = useCountUp(day.paid, 1100, useEnter(4, 220))
  const paidLen = share * C
  const pct = Math.round((hot === 'paid' ? share : 1 - share) * 100)
  const seg = (id) => ({
    className: `seg seg--${id} ${hot === id ? 'is-hot' : ''} ${hot && hot !== id ? 'is-dim' : ''}`,
    onPointerEnter: () => setHot(id),
    onPointerLeave: () => setHot(null)
  })
  return (
    <section className="card donut-card sect rise" id="sec-donut" style={{ '--d': 4 }}>
      <h3 key={day.key} className="donut-title swap-in">
        תשלומי {day.label}
      </h3>
      <div className="donut-wrap">
        <svg viewBox="0 0 200 200" className="donut" role="img" aria-label={`${day.label}: ${Math.round(share * 100)}% שולם`}>
          <g transform="rotate(-90 100 100)">
            <circle cx="100" cy="100" r={R} {...seg('bal')} strokeDasharray={`${Math.max(0, C - paidLen)} ${C}`} strokeDashoffset={-paidLen} />
            <circle cx="100" cy="100" r={R} {...seg('paid')} strokeDasharray={`${paidLen} ${C}`} />
          </g>
        </svg>
        <div className={`donut-center ${hot ? 'is-on' : ''}`} aria-hidden="true">
          <b>{pct}%</b>
          <span>{hot === 'paid' ? 'שולם' : 'נותר'}</span>
        </div>
      </div>
      <div className="donut-legend">
        <div onPointerEnter={() => setHot('bal')} onPointerLeave={() => setHot(null)}>
          <span>נותר לשלם</span>
          <b>
            <i className="dot" style={{ background: 'var(--green)' }} />
            {ils(left)}
          </b>
        </div>
        <div onPointerEnter={() => setHot('paid')} onPointerLeave={() => setHot(null)}>
          <span>כבר שולם</span>
          <b>
            <i className="dot" style={{ background: 'var(--teal)' }} />
            {ils(paid)}
          </b>
        </div>
      </div>
    </section>
  )
}

/* ============================================================== */
/* Balance (template's Savings card)                                */
function Balance({ series, net, income, expenses, monthName, onExport }) {
  const [menu, setMenu] = useState(false)
  const [showExp, setShowExp] = useState(true)
  const [hover, setHover] = useState(null)
  const menuRef = useRef(null)
  const closeMenu = useCallback(() => setMenu(false), [])
  useDismiss(menuRef, closeMenu, menu)

  const rows = series.length > 1 ? series : series.length === 1 ? [{ ...series[0], income: 0, expenses: 0, ghost: true }, series[0]] : []
  const N = rows.length
  const peak = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expenses))) * 1.08
  const areaT = useStable(rows.map((r) => (r.income / peak) * 100))
  const lineT = useStable(rows.map((r) => (r.expenses / peak) * 100))
  const area = useTween(areaT, 900)
  const line = useTween(lineT, 900)
  const inc = useCountUp(income, 1500, useEnter(3, 120))
  const exp = useCountUp(expenses, 1500, useEnter(3, 160))
  const total = useCountUp(net, 1700, useEnter(3, 200))

  const chartRef = useRef(null)
  const { w, h } = useSize(chartRef)
  const x = (i) => (i * w) / Math.max(1, N - 1)
  const y = (v) => h - (v / 100) * (h - 4)
  const ptsA = (area.length === N ? area : areaT).map((v, i) => [x(i), y(v)])
  const ptsL = (line.length === N ? line : lineT).map((v, i) => [x(i), y(v)])
  const lineA = w && N > 1 ? monotone(ptsA) : ''
  const lineL = w && N > 1 ? monotone(ptsL) : ''

  return (
    <section className="savings sect rise" id="sec-balance" style={{ '--d': 3 }}>
      <div className="sec-head">
        <h2 className="sec-title">מאזן החודש</h2>
      </div>
      <div className="card sv-card">
        <div className="sv-stats">
          <div>
            <b>{ils(Math.round(inc))}</b>
            <span>הכנסות</span>
          </div>
          <i className="sv-sep" />
          <div>
            <b>{ils(Math.round(exp))}</b>
            <span>הוצאות</span>
          </div>
        </div>
        <div
          className="sv-chart"
          ref={chartRef}
          onPointerMove={(e) => {
            if (N < 2) return
            const r = chartRef.current.getBoundingClientRect()
            setHover(Math.max(0, Math.min(N - 1, Math.round(((e.clientX - r.left) / r.width) * (N - 1)))))
          }}
          onPointerLeave={() => setHover(null)}
        >
          {w > 0 && N > 1 && (
            <svg width={w} height={h}>
              <defs>
                <linearGradient id="svFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#62b866" />
                  <stop offset="0.55" stopColor="#4ea463" />
                  <stop offset="1" stopColor="#3b8a63" />
                </linearGradient>
              </defs>
              <path d={toArea(lineA, ptsA, h + 2)} fill="url(#svFill)" />
              <path className="sv-edge" d={lineA} />
              {showExp && <path className="sv-dash" d={lineL} />}
              {hover != null && !rows[hover]?.ghost && (
                <g className="sv-focus">
                  <line x1={ptsA[hover][0]} x2={ptsA[hover][0]} y1={ptsA[hover][1]} y2={h} />
                  <circle cx={ptsA[hover][0]} cy={ptsA[hover][1]} r="5" />
                </g>
              )}
            </svg>
          )}
        </div>
        {hover != null && w > 0 && N > 1 && !rows[hover]?.ghost && (
          <div className="sv-tip" style={{ left: ptsA[hover][0], bottom: h - ptsA[hover][1] + 12 }}>
            {rows[hover].label} · נטו <b>{ils(rows[hover].net)}</b>
          </div>
        )}
        <div className="sv-total">
          <b>{ils(Math.round(total))}</b>
          <span>מאזן נטו · {monthName}</span>
        </div>
        <div className="pop-anchor sv-menu" ref={menuRef}>
          <button className="icon-btn icon-btn--light" onClick={() => setMenu((m) => !m)} aria-label="אפשרויות" aria-expanded={menu}>
            <Icon name="dots" />
          </button>
          {menu && (
            <div className="pop pop--menu pop--up" role="menu">
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  setMenu(false)
                  onExport?.()
                }}
              >
                <Icon name="download" /> ייצוא החודש לאקסל
              </button>
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  setShowExp((t) => !t)
                  setMenu(false)
                }}
              >
                <Icon name="eye" /> {showExp ? 'הסתרת' : 'הצגת'} קו ההוצאות
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ============================================================== */
/* Billing days table (template's Portfolios)                       */
function DaysTable({ days, selected, onSelect, onOpen, query }) {
  const bodyRef = useRef(null)
  const rows = query ? days.filter((d) => d.items.some((o) => o.name.toLowerCase().includes(query))) : days
  useFlip(bodyRef, rows.map((r) => r.key).join('|'))
  const sel = days.find((d) => d.key === selected)
  return (
    <section className="pf sect rise" id="sec-days" style={{ '--d': 5 }}>
      <div className="pf-head">
        <h2 className="sec-title">ימי חיוב</h2>
        <button className="link" onClick={() => sel && onOpen(sel)}>
          פירוט {sel?.label}
        </button>
      </div>
      <div className="pf-table" role="table" aria-label="ימי חיוב">
        <div className="pf-row pf-row--head" role="row">
          <span role="columnheader">יום</span>
          <span role="columnheader">סה״כ</span>
          <span role="columnheader">נותר</span>
        </div>
        <div className="pf-body" ref={bodyRef} role="rowgroup">
          {rows.map((r, i) => (
            <button
              key={r.key}
              data-flip={r.key}
              role="row"
              style={{ '--i': i }}
              className={`pf-row ${i % 2 === 0 ? 'is-green' : 'is-grey'} ${selected === r.key ? 'is-selected' : ''}`}
              onClick={() => onSelect(r.key)}
              onDoubleClick={() => onOpen(r)}
              aria-pressed={selected === r.key}
            >
              <span className="pf-name" role="cell">
                {r.label}
              </span>
              <span role="cell">
                {ilsK(r.total)}
              </span>
              <span role="cell">
                {r.left ? ilsK(r.left) : 'שולם ✓'}
              </span>
            </button>
          ))}
          {rows.length === 0 && <p className="empty">אין תשלום שמתאים ל״{query}״</p>}
        </div>
      </div>
    </section>
  )
}

/* ============================================================== */
/* Pay now (template's Tasks)                                        */
function PayNow({ obligations, query, onToggle, onMood }) {
  const listRef = useRef(null)
  const [all, setAll] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const today = new Date().getDate()
  const list = obligations
    .filter((o) => !query || o.name.toLowerCase().includes(query))
    .sort(
      (a, b) =>
        Number(a.status === 'שולם') - Number(b.status === 'שולם') ||
        (MOOD_RANK[a.mood] ?? 2) - (MOOD_RANK[b.mood] ?? 2) ||
        DAY_ORDER[a.dayKey] - DAY_ORDER[b.dayKey] ||
        b.amount - a.amount
    )
  const open = obligations.filter((o) => o.status !== 'שולם').length
  useFlip(listRef, list.map((o) => `${o.id}${o.status}`).join('|'))
  const shape = `${list.length}|${all}`
  useLayoutEffect(() => {
    const el = listRef.current
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 4)
  }, [shape])

  return (
    <section className="card tasks sect rise" id="sec-paynow" style={{ '--d': 2 }}>
      <div className="tasks-head">
        <h2 className="sec-title">
          לשלם עכשיו <span className="count-chip">{open}</span>
        </h2>
      </div>
      <div className={`task-list ${all || query ? 'is-all' : ''}`} ref={listRef}>
        {list.map((o) => {
          const done = o.status === 'שולם'
          const urgent = !done && o.dayKey !== 'unknown' && Number(o.dayKey) <= today
          return (
            <div key={o.source + o.id} data-flip={o.source + o.id} className="task-slot">
              <div className={`task task--${MOOD_TONE[o.mood] || 'blue'} ${done ? 'is-done' : ''}`}>
                <button className="check" onClick={() => onToggle(o)} aria-pressed={done} aria-label={done ? 'סימון כלא שולם' : `סימון כשולם: ${o.name}`}>
                  <Icon name="check" />
                </button>
                <div className="task-main">
                  <p className="task-text">
                    <Highlight text={o.name} q={query} /> · <b className="task-amt">{ils(o.amount)}</b>
                  </p>
                  <p className="task-due">
                    {done ? 'שולם' : o.status === 'שולם חלקית' ? 'שולם חלקית · חיוב' : 'חיוב'}
                    {!done && <b className={urgent ? 'is-urgent' : ''}>{o.dayKey === 'unknown' ? 'תאריך לא ידוע' : `${o.dayKey} לחודש`}</b>}
                  </p>
                </div>
                {!done && (
                  <button type="button" className="task-mood" onClick={() => onMood(o)} title="כמה הספק לחוץ · לחיצה משנה" aria-label="שינוי רמת לחץ">
                    {{ happy: '😊', neutral: '😐', angry: '😠' }[o.mood] || '😊'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {list.length === 0 && <p className="empty">{query ? `אין תשלום שמתאים ל״${query}״` : 'אין תשלומים החודש'}</p>}
      </div>
      {(overflow || all) && !query && <div className={`task-fade ${all ? 'is-hidden' : ''}`} aria-hidden="true" />}
      {(overflow || all) && !query && (
        <button className="tasks-more link" onClick={() => setAll((a) => !a)}>
          {all ? 'הצג פחות' : `הצג את כל ${list.length} התשלומים`}
          <Icon name="chevronDown" className={`chev ${all ? 'is-up' : ''}`} />
        </button>
      )}
    </section>
  )
}

/* ============================================================== */
/* Payroll rings (template's Team activities)                       */
const RR = 19.5
const RC = 2 * Math.PI * RR
const PAY_PCT = { 'שולם': 100, 'שולם חלקית': 50, 'לא שולם': 0 }
function Member({ r, i }) {
  const delay = useEnter(4, 150 + i * 90)
  const target = PAY_PCT[r.status] ?? 0
  return (
    <div className="member" tabIndex={0} aria-label={`${r.emp.name}, ${ils(r.total)}, ${r.status}`}>
      <div className="mring" style={{ '--c': r.status === 'שולם' ? 'var(--green)' : r.status === 'שולם חלקית' ? 'var(--orange)' : 'var(--teal)' }}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle className="trk" cx="22" cy="22" r={RR} />
          <circle className="val" cx="22" cy="22" r={RR} strokeDasharray={RC} strokeDashoffset={RC * (1 - Math.max(target, 4) / 100)} style={{ '--C': RC, animationDelay: `${delay}ms` }} />
        </svg>
        <Avatar name={r.emp.name} className="ring-avatar" />
      </div>
      <span className="member-pct">{ilsK(r.total)}</span>
      <div className="member-tip" role="tooltip">
        <strong>{r.emp.name}</strong>
        <span>{r.emp.role || ''}</span>
        <em>
          {ils(r.total)} · {r.status}
        </em>
      </div>
    </div>
  )
}
function Payroll({ rows, total, onOpen }) {
  const shown = rows.slice(0, 4)
  return (
    <section className="team sect rise" id="sec-team" style={{ '--d': 4 }}>
      <div className="sec-head">
        <h2 className="sec-title">שכר החודש</h2>
        <button className="link sec-link" onClick={onOpen}>
          {ils(total)}
        </button>
      </div>
      <div className="card team-card">
        {shown.map((r, i) => (
          <Member key={r.emp.id} r={r} i={i} />
        ))}
        {rows.length === 0 && <p className="empty ice-span">עוד לא הוגדרו עובדים</p>}
      </div>
    </section>
  )
}

/* ============================================================== */
/* Income by source (template's Deal flow)                          */
function IncomeFlow({ incomeEntries, total, prevIncome, onOpen }) {
  const data = SOURCES.map((s) => incomeEntries.filter((i) => i.source === s.id).reduce((a, c) => a + (Number(c.amount) || 0), 0))
  const series = useMemo(() => [{ id: 'inc', label: 'הכנסות', color: 'var(--teal)', data }], [data.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="flow sect rise" id="sec-flow" style={{ '--d': 5 }}>
      <div className="sec-head">
        <h2 className="sec-title">הכנסות לפי מקור</h2>
        <button className="link sec-link" onClick={onOpen}>
          לכל ההכנסות
        </button>
      </div>
      <div className="card flow-card">
        <div className="flow-top">
          <div>
            <b>{ils(total)}</b>
            <span>נכנסו החודש</span>
          </div>
          <Delta value={prevIncome ? pctChange(total, prevIncome) : null} />
        </div>
        <BarChart labels={SOURCES.map((s) => s.short)} series={series} height="6.8rem" yTicks={false} d={5} format={(v) => ilsK(v)} />
      </div>
    </section>
  )
}

export { compact, num }
