/* ------------------------------------------------------------------
   לוח בקרה — the practical board (Amit, Nov 2026):
   1. five category blocks (fixed, variable, payroll, debts, deliveries);
      each one splits into total / left to pay / paid, and every part opens a popup list
   2. the month's balance: income, expenses, paid, left to pay, profit (income − expenses)
   3. payment days (10 / 15 / 19 / unknown) → popup of who is still unpaid and how patient they are
   4. cash flow over time + income by source
------------------------------------------------------------------- */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { BarChart, Delta, MOODS, MoodPill, PageHead, Pill, Segmented, StatusPill, nextMood, nextStatus } from './kit'
import { compact, ils, ilsK, monotone, num, pctChange, placePill, toArea, useCountUp, useEnter, useFontsReady, useSize, useStable, useTween } from './lib'
import { computePay, VAT_RATE } from '../lib/payroll'
import { dbService } from '../lib/supabase'
import { Modal, MonthBar } from './pages/common'

const SHORT_MONTH = ['', 'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const SOURCES = [
  { id: 'מקסימוס', short: 'מקס׳' },
  { id: 'UPS', short: 'UPS' },
  { id: 'מזומן', short: 'מזומן' },
  { id: 'העברה בנקאית', short: 'העברה' },
  { id: 'משולם / GROW', short: 'GROW' }
]
const CATS = [
  { id: 'fixed', title: 'הוצאות קבועות', icon: 'receipt', tone: '#2c6d85', page: 'fixed_expenses' },
  { id: 'variable', title: 'הוצאות משתנות', icon: 'card', tone: '#a65ad6', page: 'variable_expenses' },
  { id: 'payroll', title: 'עובדים ושכר', icon: 'users', tone: '#3f9163', page: 'employees' },
  { id: 'debt', title: 'חובות והלוואות', icon: 'bank', tone: '#e0892a', page: 'debts' },
  { id: 'delivery', title: 'שליחויות', icon: 'truck', tone: '#3a87a0', page: 'deliveries' }
]
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]))
const DAYS = [
  { key: '10', dn: 10, label: '10 לחודש' },
  { key: '15', dn: 15, label: '15 לחודש' },
  { key: '19', dn: 19, label: '19 לחודש' },
  { key: 'unknown', dn: null, label: 'תאריך לא ידוע' }
]
const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.key, d.label]))
const DAY_ORDER = { 10: 0, 15: 1, 19: 2, unknown: 3 }
const MOOD_RANK = { angry: 0, neutral: 1, happy: 2 }
const PAID = 'שולם'
const UNPAID = 'לא שולם'
const FILTERS = [
  { id: 'all', label: 'סה״כ לשלם' },
  { id: 'left', label: 'נותר לשלם' },
  { id: 'paid', label: 'שולם' }
]

const n0 = (v) => Number(v) || 0
/** '1 פתוח' / '3 פתוחים' */
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`
const isPaid = (o) => o.status === PAID
const sumOf = (list) => list.reduce((a, o) => a + o.amount, 0)
const bucketKey = (n) => (n == null || isNaN(n) ? 'unknown' : String([10, 15, 19].reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p))))
const monthLabel = (m) => (m ? (m.name.includes(String(m.year)) ? m.name : `${m.name} ${m.year}`) : '')
const fmtDate = (s) => {
  if (!s) return ''
  const p = String(s).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : s
}
/** Totals of a list: everything, what is still open (incl. partly paid) and what is fully paid. */
const stats = (list) => {
  const paidL = list.filter(isPaid)
  const leftL = list.filter((o) => !isPaid(o))
  return { list, n: list.length, total: sumOf(list), paid: sumOf(paidL), left: sumOf(leftL), paidN: paidL.length, leftN: leftL.length }
}
/** Payroll of one month from its employee_months rows (0 when that month was never filled in). */
const payrollOf = (employees, rows = []) => {
  if (!rows.length) return 0
  const by = Object.fromEntries(rows.map((r) => [r.employee_id, r]))
  return employees.filter((e) => e.active !== false).reduce((a, e) => a + computePay(e, by[e.id], employees, by).total, 0)
}

/** Amount that counts up when it appears or changes. */
function Money({ v, d = 0 }) {
  const x = useCountUp(v, 1100, useEnter(d, 120))
  return <>{ils(Math.round(x))}</>
}

/* ============================================================== */
export default function Dashboard(props) {
  const {
    fixedExpenses = [],
    variableExpenses = [],
    debts = [],
    incomeEntries = [],
    deliveries = [],
    employees = [],
    employeeMonths = [],
    months = [],
    activeMonthId = '',
    onChangeMonth,
    onAddMonth,
    onExport,
    exporting,
    onSaveFixedExpense,
    onSaveVariableExpense,
    onSaveDebt,
    onSaveDelivery,
    onSaveEmployeeMonth,
    onNavigate,
    notify
  } = props

  const empMonthById = useMemo(() => Object.fromEntries(employeeMonths.map((m) => [m.employee_id, m])), [employeeMonths])

  /* ---------- every payment of the month, in one shape ---------- */
  const items = useMemo(
    () => [
      ...fixedExpenses.map((e) => ({ uid: `f${e.id}`, cat: 'fixed', name: e.name, amount: n0(e.amount), status: e.status || UNPAID, dayKey: bucketKey(e.payment_date ? parseInt(e.payment_date, 10) : NaN), mood: e.mood || 'happy', raw: e })),
      ...variableExpenses.map((e) => ({ uid: `v${e.id}`, cat: 'variable', name: e.name, amount: n0(e.amount), status: e.status || UNPAID, dayKey: bucketKey(e.date ? parseInt(String(e.date).split('-')[2], 10) : NaN), mood: e.mood || 'happy', raw: e })),
      ...employees
        .filter((e) => e.active !== false)
        .map((e) => ({ uid: `p${e.id}`, cat: 'payroll', name: e.name, sub: e.role, amount: computePay(e, empMonthById[e.id], employees, empMonthById).total, status: empMonthById[e.id]?.status || UNPAID, raw: e })),
      ...debts.map((d) => ({ uid: `d${d.id}`, cat: 'debt', name: d.name, amount: n0(d.monthly_payment), status: d.status || UNPAID, dayKey: bucketKey(d.payment_date ? parseInt(String(d.payment_date).split('-').pop(), 10) : NaN), mood: d.mood || 'happy', raw: d })),
      ...deliveries.map((d) => ({ uid: `s${d.id}`, cat: 'delivery', name: `${d.route_from} ← ${d.route_to}`, sub: fmtDate(d.date), amount: n0(d.price) * (1 + VAT_RATE), status: d.status || UNPAID, raw: d }))
    ],
    [fixedExpenses, variableExpenses, employees, empMonthById, debts, deliveries]
  )

  const save = useCallback(
    (o, patch) => {
      const r = o.raw
      if (o.cat === 'fixed') return onSaveFixedExpense?.({ ...r, ...patch })
      if (o.cat === 'variable') return onSaveVariableExpense?.({ ...r, ...patch })
      if (o.cat === 'debt') return onSaveDebt?.({ ...r, ...patch })
      if (o.cat === 'delivery') return onSaveDelivery?.({ ...r, ...patch })
      if (o.cat === 'payroll') {
        const m = empMonthById[r.id]
        return onSaveEmployeeMonth?.({ employee_id: r.id, month_id: activeMonthId, hours: m?.hours || 0, deals_count: m?.deals_count || 0, deals_amount: m?.deals_amount || 0, status: m?.status || UNPAID, notes: m?.notes || '', ...patch })
      }
      return undefined
    },
    [onSaveFixedExpense, onSaveVariableExpense, onSaveDebt, onSaveDelivery, onSaveEmployeeMonth, empMonthById, activeMonthId]
  )
  const setStatus = (o, next) => {
    const prev = o.status
    save(o, { status: next })
    if (next === PAID) notify?.(`סומן כשולם: ${o.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => save(o, { status: prev }) } })
  }
  const togglePaid = (o) => setStatus(o, isPaid(o) ? UNPAID : PAID)
  const cycleStatus = (o) => setStatus(o, nextStatus(o.status))
  const cycleMood = (o) => save(o, { mood: nextMood(o.mood) })

  /* ---------- numbers ---------- */
  const cats = CATS.map((c) => ({ ...c, ...stats(items.filter((o) => o.cat === c.id)) }))
  const all = stats(items)
  const income = incomeEntries.reduce((a, e) => a + n0(e.amount), 0)
  const profit = income - all.total
  const dated = items.filter((o) => o.dayKey)
  const days = DAYS.map((d) => {
    const s = stats(dated.filter((o) => o.dayKey === d.key))
    const open = s.list.filter((o) => !isPaid(o))
    return { ...d, ...s, angry: open.filter((o) => o.mood === 'angry').length, neutral: open.filter((o) => o.mood === 'neutral').length, calm: open.filter((o) => o.mood === 'happy').length }
  })

  /* ---------- history (cash-flow chart) ---------- */
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
    if (m.id === activeMonthId) return { m, label: SHORT_MONTH[m.month_number] || m.name, income, expenses: all.total, net: profit }
    const t = hist[m.id] || {}
    const exp = n0(t.fixed) + n0(t.variable) + n0(t.debts) + n0(t.deliveries) * (1 + VAT_RATE) + payrollOf(employees, t.staff)
    return { m, label: SHORT_MONTH[m.month_number] || m.name, income: n0(t.income), expenses: exp, net: n0(t.income) - exp }
  })
  const prev = series.length > 1 ? series[series.length - 2] : null

  /* today, only when the open month is the calendar month */
  const now = new Date()
  const isThisMonth = activeMonth && activeMonth.year === now.getFullYear() && activeMonth.month_number === now.getMonth() + 1
  const today = isThisMonth ? now.getDate() : null

  /* ---------- popup ---------- */
  const [pop, setPop] = useState(null) // { kind: 'cat' | 'day' | 'all', key, filter }
  const popData = (() => {
    if (!pop) return null
    if (pop.kind === 'cat') {
      const c = cats.find((x) => x.id === pop.key)
      return { title: c.title, icon: c.icon, tone: c.tone, s: c, page: c.page, showDay: c.id !== 'payroll' && c.id !== 'delivery' }
    }
    if (pop.kind === 'day') {
      const d = days.find((x) => x.key === pop.key)
      const moods = [d.angry && pl(d.angry, 'כועס', 'כועסים'), d.neutral && pl(d.neutral, 'העיר', 'העירו'), d.calm && pl(d.calm, 'רגוע', 'רגועים')].filter(Boolean).join(' · ')
      return { title: d.key === 'unknown' ? 'תשלומים בלי תאריך' : `תשלומים ב־${d.label}`, icon: 'calendar', tone: '#2c6d85', s: d, sub: moods, showCat: true }
    }
    return { title: 'כל התשלומים של החודש', icon: 'wallet', tone: '#2c6d85', s: all, showCat: true, showDay: true }
  })()

  return (
    <div className="page ice-dash">
      <PageHead
        title="לוח בקרה"
        sub={
          <>
            {monthLabel(activeMonth)} · נותר לשלם <b>{ils(all.left)}</b> מתוך {ils(all.total)}
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--white" onClick={onExport} disabled={exporting}>
          <Icon name="download" /> {exporting ? 'מייצא...' : 'ייצוא לאקסל'}
        </button>
      </PageHead>

      {/* ---------- 1. category blocks ---------- */}
      <section className="ice-row">
        <div className="ice-row-head">
          <h2 className="sec-title">תשלומים לפי קטגוריה</h2>
          <p className="sec-sub">לחיצה על כל סכום פותחת את הרשימה</p>
        </div>
        <div className="ice-cats">
          {cats.map((c, i) => (
            <div key={c.id} className="ice-slot">
              <CatBlock c={c} d={i} onOpen={(filter) => setPop({ kind: 'cat', key: c.id, filter })} onPage={() => onNavigate?.(c.page)} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 2. balance ---------- */}
      <section className="ice-row">
        <div className="ice-row-head">
          <h2 className="sec-title">מאזן החודש</h2>
          <p className="sec-sub">רווח = הכנסות פחות הוצאות</p>
        </div>
        <div className="card ice-bal card-in" style={{ '--d': 5 }}>
          <button type="button" className="ice-bal-cell" style={{ '--tone': '#57b05c' }} onClick={() => onNavigate?.('income')}>
            <span className="ice-bal-top">
              <span className="ice-bal-ic">
                <Icon name="coins" />
              </span>
              סה״כ הכנסות
            </span>
            <b>
              <Money v={income} d={5} />
            </b>
            <small>{incomeEntries.length} רשומות הכנסה</small>
          </button>
          <button type="button" className="ice-bal-cell" style={{ '--tone': '#a65ad6' }} onClick={() => setPop({ kind: 'all', filter: 'all' })}>
            <span className="ice-bal-top">
              <span className="ice-bal-ic">
                <Icon name="wallet" />
              </span>
              סה״כ הוצאות
            </span>
            <b>
              <Money v={all.total} d={5} />
            </b>
            <small>{all.n} תשלומים ב־5 קטגוריות</small>
          </button>
          <button type="button" className="ice-bal-cell" style={{ '--tone': '#3f9163' }} onClick={() => setPop({ kind: 'all', filter: 'paid' })}>
            <span className="ice-bal-top">
              <span className="ice-bal-ic">
                <Icon name="check" />
              </span>
              סה״כ שולם
            </span>
            <b>
              <Money v={all.paid} d={5} />
            </b>
            <small>{all.total ? Math.round((all.paid / all.total) * 100) : 0}% מההוצאות</small>
          </button>
          <button type="button" className="ice-bal-cell" style={{ '--tone': '#e0892a' }} onClick={() => setPop({ kind: 'all', filter: 'left' })}>
            <span className="ice-bal-top">
              <span className="ice-bal-ic">
                <Icon name="clock" />
              </span>
              סה״כ נותר לשלם
            </span>
            <b>
              <Money v={all.left} d={5} />
            </b>
            <small>{pl(all.leftN, 'תשלום פתוח', 'תשלומים פתוחים')}</small>
          </button>
          <div className={`ice-bal-profit ${profit < 0 ? 'is-neg' : ''}`}>
            <span className="ice-bal-top">
              <span className="ice-bal-ic">
                <Icon name={profit < 0 ? 'trendDown' : 'trendUp'} />
              </span>
              {profit < 0 ? 'הפסד החודש' : 'רווח החודש'}
            </span>
            <b>
              <Money v={profit} d={5} />
            </b>
            <small>{income ? `${Math.round((profit / income) * 100)}% מההכנסות נשארו בעסק` : 'הכנסות פחות הוצאות'}</small>
          </div>
        </div>
      </section>

      {/* ---------- 3. payment days ---------- */}
      <section className="ice-row">
        <div className="ice-row-head">
          <h2 className="sec-title">ימי תשלום</h2>
          <p className="sec-sub">כמה נשאר לשלם בכל תאריך · הוצאות קבועות, משתנות וחובות</p>
        </div>
        <div className="ice-days">
          {days.map((d, i) => (
            <div key={d.key} className="ice-slot">
              <DayBlock day={d} today={today} d={6 + i} onOpen={() => setPop({ kind: 'day', key: d.key, filter: 'left' })} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 4. charts ---------- */}
      <div className="split ice-charts">
        <CashFlow series={series} monthName={monthLabel(activeMonth)} totalIncome={income} />
        <IncomeFlow incomeEntries={incomeEntries} total={income} prevIncome={prev?.income} onOpen={() => onNavigate?.('income')} />
      </div>

      {pop && popData && (
        <Modal label={popData.title} onClose={() => setPop(null)} className="ice-pop">
          {(close) => (
            <ListPopup
              data={popData}
              filter={pop.filter}
              onFilter={(filter) => setPop((p) => ({ ...p, filter }))}
              close={close}
              onToggle={togglePaid}
              onStatus={cycleStatus}
              onMood={cycleMood}
              onPage={
                popData.page
                  ? () => {
                      close()
                      onNavigate?.(popData.page)
                    }
                  : null
              }
            />
          )}
        </Modal>
      )}
    </div>
  )
}

/* ============================================================== */
/* One category: total on top, then left-to-pay and paid tiles.   */
function CatBlock({ c, d, onOpen, onPage }) {
  const pct = c.total ? Math.round((c.paid / c.total) * 100) : 0
  return (
    <section className="card ice-cat card-in" style={{ '--d': d, '--tone': c.tone }}>
      <button type="button" className="ice-cat-head" onClick={onPage} title={`לעמוד ${c.title}`}>
        <span className="ice-cat-ic">
          <Icon name={c.icon} />
        </span>
        <h3>{c.title}</h3>
        <Icon name="chevronLeft" className="ice-cat-go" />
      </button>
      <div className="ice-cat-body">
        <button type="button" className="ice-tile ice-tile--total" onClick={() => onOpen('all')}>
          <span>סה״כ לשלם</span>
          <b>
            <Money v={c.total} d={d} />
          </b>
          <small>{pl(c.n, 'פריט', 'פריטים')}</small>
        </button>
        <div className="ice-bar" role="img" aria-label={`${pct}% שולם`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <button type="button" className={`ice-tile ice-tile--left ${c.left ? '' : 'is-zero'}`} onClick={() => onOpen('left')}>
          <span>
            <i className="dot" /> נותר לשלם
          </span>
          <b>
            <Money v={c.left} d={d} />
          </b>
          <small>{c.left ? pl(c.leftN, 'פתוח', 'פתוחים') : c.n ? 'הכל שולם' : '—'}</small>
        </button>
        <button type="button" className="ice-tile ice-tile--paid" onClick={() => onOpen('paid')}>
          <span>
            <i className="dot" /> שולם
          </span>
          <b>
            <Money v={c.paid} d={d} />
          </b>
          <small>
            {c.paidN} מתוך {c.n}
          </small>
        </button>
      </div>
    </section>
  )
}

/* ============================================================== */
/* One payment day: what is still open on it, and who is pushing. */
function DayBlock({ day, today, d, onOpen }) {
  const pct = day.total ? Math.round((day.paid / day.total) * 100) : 0
  let state = null
  if (day.n && !day.left) state = { tone: 'green', text: 'הכל שולם' }
  else if (today != null && day.dn != null && day.left) {
    if (day.dn < today) state = { tone: 'red', text: 'התאריך עבר' }
    else if (day.dn === today) state = { tone: 'orange', text: 'היום' }
    else state = { tone: 'grey', text: `בעוד ${day.dn - today} ימים` }
  }
  return (
    <button type="button" className="card ice-day card-in" style={{ '--d': d }} onClick={onOpen}>
      <div className="ice-day-top">
        <span className="ice-day-date">
          {day.dn != null ? (
            <>
              <b>{day.dn}</b>
              <small>לחודש</small>
            </>
          ) : (
            <>
              <b>?</b>
              <small>תאריך לא ידוע</small>
            </>
          )}
        </span>
        {state && (
          <Pill tone={state.tone} dot={false}>
            {state.text}
          </Pill>
        )}
      </div>
      <span className="ice-day-label">נותר לשלם</span>
      <b className="ice-day-amt">
        <Money v={day.left} d={d} />
      </b>
      <div className="ice-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="ice-day-foot">
        מתוך {ils(day.total)} · {pl(day.leftN, 'פתוח', 'פתוחים')}
      </p>
      <div className="ice-day-moods">
        {day.angry > 0 && (
          <Pill tone="red" dot={false}>
            {MOODS.angry.emoji} {pl(day.angry, 'כועס', 'כועסים')}
          </Pill>
        )}
        {day.neutral > 0 && (
          <Pill tone="orange" dot={false}>
            {MOODS.neutral.emoji} {pl(day.neutral, 'העיר', 'העירו')}
          </Pill>
        )}
        {day.calm > 0 && (
          <Pill tone="green" dot={false}>
            {MOODS.happy.emoji} {pl(day.calm, 'רגוע', 'רגועים')}
          </Pill>
        )}
        {!day.leftN && <span className="ice-day-none">אין תשלומים פתוחים</span>}
      </div>
    </button>
  )
}

/* ============================================================== */
/* Popup list: three switchable totals, then the payments.         */
function ListPopup({ data, filter, onFilter, close, onToggle, onStatus, onMood, onPage }) {
  const { s } = data
  const list = s.list
    .filter((o) => (filter === 'left' ? !isPaid(o) : filter === 'paid' ? isPaid(o) : true))
    .sort(
      (a, b) =>
        Number(isPaid(a)) - Number(isPaid(b)) ||
        (MOOD_RANK[a.mood] ?? 3) - (MOOD_RANK[b.mood] ?? 3) ||
        (DAY_ORDER[a.dayKey] ?? 4) - (DAY_ORDER[b.dayKey] ?? 4) ||
        b.amount - a.amount
    )
  const value = { all: s.total, left: s.left, paid: s.paid }
  const count = { all: pl(s.n, 'פריט', 'פריטים'), left: pl(s.leftN, 'פתוח', 'פתוחים'), paid: pl(s.paidN, 'שולם', 'שולמו') }
  return (
    <div className="ice-pop-in" style={{ '--tone': data.tone }}>
      <header className="ice-pop-head">
        <span className="ice-cat-ic">
          <Icon name={data.icon} />
        </span>
        <div>
          <h2>{data.title}</h2>
          <p>{data.sub || `${s.n} תשלומים החודש`}</p>
        </div>
        <button type="button" className="icon-btn icon-btn--soft ice-pop-x" onClick={close} aria-label="סגירה">
          <Icon name="x" />
        </button>
      </header>

      <div className="ice-pop-tabs" role="tablist" aria-label="סינון">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`ice-pop-tab ice-pop-tab--${f.id} ${filter === f.id ? 'is-on' : ''}`} onClick={() => onFilter(f.id)}>
            <span>{f.label}</span>
            <b>{ils(value[f.id])}</b>
            <small>{count[f.id]}</small>
          </button>
        ))}
      </div>

      <ul className="ice-pop-list">
        {list.map((o) => {
          const done = isPaid(o)
          const where = [data.showCat && CAT[o.cat].title, data.showDay && o.dayKey && DAY_LABEL[o.dayKey], o.sub].filter(Boolean).join(' · ')
          return (
            <li key={o.uid} className={`ice-pop-row ${done ? 'is-paid' : ''} ${o.mood && !done ? `is-${o.mood}` : ''}`}>
              <button type="button" className={`ice-check ${done ? 'is-on' : ''}`} onClick={() => onToggle(o)} aria-pressed={done} aria-label={done ? `החזרה ללא שולם: ${o.name}` : `סימון כשולם: ${o.name}`} title={done ? 'החזרה ללא שולם' : 'סימון כשולם'}>
                <Icon name="check" />
              </button>
              <div className="ice-pop-main">
                <b>{o.name}</b>
                {where && <span>{where}</span>}
              </div>
              <b className="ice-pop-amt">{ils(o.amount)}</b>
              <div className="ice-pop-pills">
                <StatusPill status={o.status} onClick={() => onStatus(o)} />
                {o.mood && <MoodPill mood={o.mood} onClick={() => onMood(o)} />}
              </div>
            </li>
          )
        })}
        {list.length === 0 && (
          <li className="ice-pop-empty">
            <Icon name={filter === 'left' ? 'check' : 'inbox'} />
            {filter === 'left' ? 'הכל שולם כאן' : filter === 'paid' ? 'עוד לא שולם כלום' : 'אין תשלומים'}
          </li>
        )}
      </ul>

      <footer className="ice-pop-foot">
        <p>הריבוע מסמן ששולם · הסטטוס עובר בין שולם, חלקית ולא שולם · הפרצוף מעדכן כמה הספק לחוץ</p>
        {onPage && (
          <button type="button" className="btn btn--primary" onClick={onPage}>
            לעמוד {data.title}
            <Icon name="arrowRight" className="ob-arrow" />
          </button>
        )}
      </footer>
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
  const fonts = useFontsReady()
  useLayoutEffect(() => {
    placePill(tabPill.current, tabsRef.current?.querySelector('.is-on'))
  }, [range, w, fonts])

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
