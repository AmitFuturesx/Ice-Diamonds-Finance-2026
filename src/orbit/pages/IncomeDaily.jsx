/* הכנסות יומיות — enter one day (cash, bank transfer, GROW, number of orders) and read the month
   as a daily report with weekly subtotals and a monthly summary.
   The money of a day is stored as income_entries rows (one per source, channel 'יומי'), so the
   dashboard, cash flow and monthly totals pick it up on their own. Orders live in daily_orders. */
import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'
import { BarChart, CardHead, Kpi } from '../kit'
import { compact, ils } from '../lib'
import { downloadCsv } from './common'

export const DAILY = 'יומי'
const FIELDS = [
  { key: 'cash', source: 'מזומן', label: 'מזומן', icon: 'coins', tone: '#e0892a' },
  { key: 'bank', source: 'העברה בנקאית', label: 'העברה בנקאית', icon: 'bank', tone: '#a65ad6' },
  { key: 'grow', source: 'משולם / GROW', label: 'סליקה GROW', icon: 'card', tone: '#2c6d85' }
]
const SOURCE_KEY = Object.fromEntries(FIELDS.map((f) => [f.source, f.key]))
const WEEKDAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const pad = (n) => String(n).padStart(2, '0')
const n0 = (v) => Number(v) || 0
const money = (v) => (v ? ils(v) : '—')

export default function IncomeDaily({ incomeEntries = [], dailyOrders = [], monthYear, monthNumber, activeMonthId, onSaveIncome, onDeleteIncome, onSaveDailyOrders, notify }) {
  const now = new Date()
  const y = monthYear || now.getFullYear()
  const m = monthNumber || now.getMonth() + 1
  const daysInMonth = new Date(y, m, 0).getDate()
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m
  const isFuture = new Date(y, m - 1, 1) > now
  const lastDay = isCurrent ? now.getDate() : isFuture ? 0 : daysInMonth
  const prefix = `${y}-${pad(m)}-`
  const dateOf = (d) => `${prefix}${pad(d)}`

  /* ---------- the month, day by day ---------- */
  const ordersByDate = useMemo(() => Object.fromEntries(dailyOrders.map((o) => [String(o.date).slice(0, 10), n0(o.orders)])), [dailyOrders])
  const { days, undated } = useMemo(() => {
    const blank = () => ({ cash: 0, bank: 0, grow: 0, other: 0, total: 0 })
    const by = {}
    let undatedSum = 0
    for (const e of incomeEntries) {
      const date = String(e.date || '').slice(0, 10)
      if (!date.startsWith(prefix)) {
        undatedSum += n0(e.amount)
        continue
      }
      const b = (by[date] ||= blank())
      b[SOURCE_KEY[e.source] || 'other'] += n0(e.amount)
      b.total += n0(e.amount)
    }
    const list = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = dateOf(d)
      const b = by[date] || blank()
      const orders = ordersByDate[date] || 0
      list.push({ d, date, wd: new Date(y, m - 1, d).getDay(), ...b, orders, filled: b.total > 0 || orders > 0, past: d <= lastDay })
    }
    return { days: list, undated: undatedSum }
  }, [incomeEntries, ordersByDate, prefix, daysInMonth, lastDay]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownDays = days.filter((d) => d.past || d.filled)
  const sum = (k) => shownDays.reduce((a, d) => a + d[k], 0)
  const month = { total: sum('total'), cash: sum('cash'), bank: sum('bank'), grow: sum('grow'), other: sum('other'), orders: sum('orders') }
  const filled = shownDays.filter((d) => d.filled)
  const missing = days.filter((d) => d.past && !d.filled)
  const best = filled.reduce((b, d) => (!b || d.total > b.total ? d : b), null)

  /* weeks (Sunday → Saturday), newest first */
  const weeks = useMemo(() => {
    const out = []
    let cur = null
    for (const d of shownDays) {
      if (!cur || d.wd === 0) {
        cur = { days: [] }
        out.push(cur)
      }
      cur.days.push(d)
    }
    return out
      .map((w, i) => {
        const t = (k) => w.days.reduce((a, d) => a + d[k], 0)
        return { i: i + 1, from: w.days[0].d, to: w.days[w.days.length - 1].d, days: [...w.days].reverse(), total: t('total'), cash: t('cash'), bank: t('bank'), grow: t('grow'), other: t('other'), orders: t('orders') }
      })
      .reverse()
  }, [shownDays.map((d) => `${d.date}:${d.total}:${d.orders}`).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- the entry form ---------- */
  const defaultDay = isCurrent ? now.getDate() : isFuture ? 1 : daysInMonth
  const [day, setDay] = useState(defaultDay)
  const date = dateOf(day)
  const dailyOf = (dt, source) => incomeEntries.find((e) => String(e.date || '').slice(0, 10) === dt && e.source === source && e.channel === DAILY)
  const loadVals = (dt) => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, dailyOf(dt, f.source) ? String(n0(dailyOf(dt, f.source).amount)) : ''])),
    orders: ordersByDate[dt] != null ? String(ordersByDate[dt]) : ''
  })
  const [vals, setVals] = useState(() => loadVals(date))
  const [busy, setBusy] = useState(false)
  const formRef = useRef(null)
  useEffect(() => {
    setVals(loadVals(date))
  }, [date, activeMonthId]) // eslint-disable-line react-hooks/exhaustive-deps

  const formTotal = FIELDS.reduce((a, f) => a + n0(vals[f.key]), 0)
  const formOrders = n0(vals.orders)
  const thisDay = days[day - 1]
  const otherThatDay = thisDay ? thisDay.total - FIELDS.reduce((a, f) => a + n0(dailyOf(date, f.source)?.amount), 0) : 0
  const alreadyFilled = FIELDS.some((f) => dailyOf(date, f.source)) || ordersByDate[date] != null

  const pickDay = (d, scroll) => {
    setDay(Math.min(daysInMonth, Math.max(1, d)))
    if (scroll) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    let ok = true
    for (const f of FIELDS) {
      const amount = n0(vals[f.key])
      const existing = dailyOf(date, f.source)
      if (existing && amount === 0) onDeleteIncome?.(existing.id)
      else if (existing && amount !== n0(existing.amount)) ok = (await onSaveIncome({ ...existing, amount })) !== false && ok
      else if (!existing && amount > 0) ok = (await onSaveIncome({ month_id: activeMonthId, source: f.source, amount, channel: DAILY, date })) !== false && ok
    }
    if (vals.orders !== '' && formOrders !== ordersByDate[date]) ok = (await onSaveDailyOrders?.({ month_id: activeMonthId, date, orders: formOrders })) !== false && ok
    setBusy(false)
    if (ok) {
      notify?.(`נשמר יום ${WEEKDAY[thisDay.wd]} ${day}/${m}: ${ils(formTotal)}${vals.orders !== '' ? ` · ${formOrders} הזמנות` : ''}`, { tone: 'success' })
      const next = missing.find((d) => d.d > day) || missing.find((d) => d.d !== day)
      if (next && !isCurrent) pickDay(next.d)
    }
  }

  const exportCsv = () => {
    const rows = [['תאריך', 'יום', 'מזומן', 'העברה בנקאית', 'GROW', 'אחר', 'סה״כ', 'הזמנות']]
    for (const d of shownDays) rows.push([`${d.d}/${m}/${y}`, WEEKDAY[d.wd], d.cash, d.bank, d.grow, d.other, d.total, d.orders])
    rows.push(['סה״כ החודש', '', month.cash, month.bank, month.grow, month.other, month.total, month.orders])
    downloadCsv(`דוח-יומי-${m}-${y}.csv`, rows)
    notify?.('הדוח היומי יוצא לקובץ', { tone: 'success' })
  }

  const chartSeries = useMemo(() => [{ id: 'day', label: 'הכנסות', color: 'var(--green)', data: shownDays.map((d) => d.total) }], [shownDays.map((d) => d.total).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="ice-daily-top">
        {/* ---------- enter a day ---------- */}
        <section className="card card-pad card-in ice-day-form" style={{ '--d': 1 }} ref={formRef}>
          <div className="ice-day-form-head">
            <div>
              <h2>הזנת הכנסות יומית</h2>
              <p>{alreadyFilled ? 'היום הזה כבר מולא · שמירה תעדכן אותו' : 'כמה כסף נכנס היום ומאיפה'}</p>
            </div>
            <div className="ice-day-nav">
              <button type="button" className="icon-btn icon-btn--soft" onClick={() => pickDay(day - 1)} disabled={day <= 1} aria-label="יום קודם">
                <Icon name="chevronRight" />
              </button>
              <label className="ice-day-pick">
                <b>
                  יום {WEEKDAY[thisDay?.wd ?? 0]} · {day}/{m}
                </b>
                <input type="date" value={date} min={dateOf(1)} max={dateOf(daysInMonth)} onChange={(e) => e.target.value && pickDay(Number(e.target.value.slice(8, 10)))} aria-label="בחירת תאריך" />
              </label>
              <button type="button" className="icon-btn icon-btn--soft" onClick={() => pickDay(day + 1)} disabled={day >= daysInMonth} aria-label="יום הבא">
                <Icon name="chevronLeft" />
              </button>
            </div>
          </div>

          <div className="ice-day-fields">
            {FIELDS.map((f) => (
              <label key={f.key} className="ice-day-field" style={{ '--tone': f.tone }}>
                <span>
                  <i className="ice-day-field-ic">
                    <Icon name={f.icon} />
                  </i>
                  {f.label}
                </span>
                <div className="ice-day-input">
                  <em>₪</em>
                  <input inputMode="decimal" value={vals[f.key]} placeholder="0" onChange={(e) => setVals({ ...vals, [f.key]: e.target.value.replace(/[^\d.]/g, '') })} onKeyDown={(e) => e.key === 'Enter' && save()} />
                </div>
              </label>
            ))}
            <label className="ice-day-field" style={{ '--tone': '#3f9163' }}>
              <span>
                <i className="ice-day-field-ic">
                  <Icon name="receipt" />
                </i>
                הזמנות היום
              </span>
              <div className="ice-day-input">
                <em>#</em>
                <input inputMode="numeric" value={vals.orders} placeholder="0" onChange={(e) => setVals({ ...vals, orders: e.target.value.replace(/\D/g, '') })} onKeyDown={(e) => e.key === 'Enter' && save()} />
              </div>
            </label>
          </div>

          <div className="ice-day-sum">
            <div>
              <span>סה״כ נכנס ביום הזה</span>
              <b>{ils(formTotal)}</b>
            </div>
            {formOrders > 0 && (
              <div>
                <span>ממוצע להזמנה</span>
                <b>{ils(formTotal / formOrders)}</b>
              </div>
            )}
          </div>
          {otherThatDay > 0 && <p className="ice-day-note">ביום הזה יש עוד {ils(otherThatDay)} מרשומות הכנסה אחרות (למשל מקסימוס או UPS). הן נספרות בדוח.</p>}
          <button type="button" className="btn btn--primary btn--block ice-day-save" onClick={save} disabled={busy}>
            <Icon name="check" /> {busy ? 'שומר...' : alreadyFilled ? 'עדכון היום' : 'שמירת היום'}
          </button>
        </section>

        {/* ---------- month summary ---------- */}
        <div className="ice-daily-kpis">
          <Kpi icon="coins" label="סה״כ הכנסות החודש" value={month.total + undated} d={2} foot={`מזומן ${ils(month.cash)} · העברה ${ils(month.bank)} · GROW ${ils(month.grow)}`} />
          <Kpi icon="receipt" label="הזמנות החודש" value={month.orders} format="num" tone="teal" d={3} foot={month.orders ? `ממוצע ${ils(month.total / month.orders)} להזמנה` : 'עוד לא הוזנו הזמנות'} />
          <Kpi icon="trendUp" label="ממוצע ליום" value={filled.length ? month.total / filled.length : 0} tone="purple" d={4} foot={best ? `היום החזק: ${best.d}/${m} · ${ils(best.total)}` : 'עוד אין ימים מלאים'} />
          <Kpi
            icon="calendar"
            label="ימים שמולאו"
            value={filled.length}
            format="num"
            tone={missing.length ? 'orange' : 'green'}
            d={5}
            foot={missing.length ? `חסרים: ${missing.slice(-6).map((d) => d.d).join(', ')}${missing.length > 6 ? '…' : ''}` : lastDay ? 'כל הימים מולאו' : 'החודש עוד לא התחיל'}
            onClick={missing.length ? () => pickDay(missing[missing.length - 1].d, true) : undefined}
          />
        </div>
      </div>

      {/* ---------- chart ---------- */}
      {shownDays.length > 0 && (
        <section className="card card-pad card-in" style={{ '--d': 6 }}>
          <CardHead title="הכנסות לפי יום" sub={`${filled.length} ימים עם הכנסות · סה״כ ${ils(month.total)}`} icon="bars" />
          <BarChart labels={shownDays.map((d) => String(d.d))} series={chartSeries} height="12rem" d={6} format={(v) => `₪${compact(v)}`} onSelect={(i) => pickDay(shownDays[i].d, true)} />
        </section>
      )}

      {/* ---------- daily report ---------- */}
      <section className="card card-pad card-in" style={{ '--d': 7 }}>
        <CardHead title="דוח יומי" sub="כל יום בחודש, עם סיכום לכל שבוע · לחיצה על יום פותחת אותו להזנה" icon="calendar">
          <button type="button" className="btn btn--white btn--sm" onClick={exportCsv} disabled={!shownDays.length}>
            <Icon name="download" /> ייצוא
          </button>
        </CardHead>

        {shownDays.length === 0 ? (
          <p className="empty">החודש הזה עוד לא התחיל.</p>
        ) : (
          <div className="ice-rep">
            <div className="ice-rep-row ice-rep-head">
              <span>יום</span>
              <span>מזומן</span>
              <span>העברה</span>
              <span>GROW</span>
              <span>אחר</span>
              <span>סה״כ</span>
              <span>הזמנות</span>
            </div>
            {weeks.map((w) => (
              <div key={w.i} className="ice-rep-week">
                {w.days.map((d) => (
                  <button key={d.date} type="button" className={`ice-rep-row ice-rep-day ${d.filled ? '' : 'is-empty'} ${d.d === day ? 'is-on' : ''} ${isCurrent && d.d === now.getDate() ? 'is-today' : ''}`} onClick={() => pickDay(d.d, true)}>
                    <span className="ice-rep-date">
                      <b>{d.d}/{m}</b> יום {WEEKDAY[d.wd]}
                    </span>
                    {d.filled ? (
                      <>
                        <span data-l="מזומן">{money(d.cash)}</span>
                        <span data-l="העברה">{money(d.bank)}</span>
                        <span data-l="GROW">{money(d.grow)}</span>
                        <span data-l="אחר">{money(d.other)}</span>
                        <b className="ice-rep-total">{ils(d.total)}</b>
                        <span data-l="הזמנות">{d.orders || '—'}</span>
                      </>
                    ) : (
                      <span className="ice-rep-missing">
                        לא מולא · <u>הזנה</u>
                      </span>
                    )}
                  </button>
                ))}
                <div className="ice-rep-row ice-rep-sub">
                  <span className="ice-rep-date">
                    <b>שבוע {w.i}</b> {w.from}–{w.to}/{m}
                  </span>
                  <span data-l="מזומן">{money(w.cash)}</span>
                  <span data-l="העברה">{money(w.bank)}</span>
                  <span data-l="GROW">{money(w.grow)}</span>
                  <span data-l="אחר">{money(w.other)}</span>
                  <b className="ice-rep-total">{ils(w.total)}</b>
                  <span data-l="הזמנות">{w.orders || '—'}</span>
                </div>
              </div>
            ))}
            <div className="ice-rep-row ice-rep-month">
              <span className="ice-rep-date">
                <b>סה״כ החודש</b>
              </span>
              <span data-l="מזומן">{money(month.cash)}</span>
              <span data-l="העברה">{money(month.bank)}</span>
              <span data-l="GROW">{money(month.grow)}</span>
              <span data-l="אחר">{money(month.other)}</span>
              <b className="ice-rep-total">{ils(month.total)}</b>
              <span data-l="הזמנות">{month.orders || '—'}</span>
            </div>
            {undated > 0 && <p className="ice-day-note">יש עוד {ils(undated)} מהכנסות החודש בלי תאריך בתוך החודש. הן נספרות בסה״כ הכנסות, אבל לא ביום מסוים.</p>}
          </div>
        )}
      </section>
    </>
  )
}
