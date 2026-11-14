/* הכנסות יומיות — the same calendar as the dashboard, then the month as a daily report
   (every day, weekly subtotals, month total, CSV). Clicking a day opens the quick entry popup. */
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { CardHead } from '../kit'
import { ils } from '../lib'
import { downloadCsv } from './common'
import IncomeCalendar, { DayModal } from '../IncomeCalendar'
import { WEEKDAY, buildMonth } from '../dailyIncome'

export { DAILY } from '../dailyIncome'
const money = (v) => (v ? ils(v) : '—')

export default function IncomeDaily(props) {
  const { incomeEntries = [], dailyOrders = [], monthYear, monthNumber, notify } = props
  const cal = useMemo(() => buildMonth({ incomeEntries, dailyOrders, year: monthYear, month: monthNumber }), [incomeEntries, dailyOrders, monthYear, monthNumber])
  const [open, setOpen] = useState(null)
  const m = cal.m
  const shown = cal.days.filter((x) => x.past || x.filled)

  /* weeks newest first, days newest first inside each week */
  const weeks = cal.weeks
    .map((w, i) => ({ ...w, i: i + 1, days: w.cells.filter((c) => c && (c.past || c.filled)).reverse() }))
    .filter((w) => w.days.length)
    .reverse()
  const wsum = (w, k) => w.days.reduce((a, x) => a + x[k], 0)

  const exportCsv = () => {
    const rows = [['תאריך', 'יום', 'מזומן', 'העברה בנקאית', 'GROW', 'אחר', 'סה״כ', 'הזמנות']]
    for (const x of shown) rows.push([`${x.d}/${m}/${cal.y}`, WEEKDAY[x.wd], x.cash, x.bank, x.grow, x.other, x.total, x.orders])
    rows.push(['סה״כ החודש', '', cal.totals.cash, cal.totals.bank, cal.totals.grow, cal.totals.other, cal.totals.total, cal.totals.orders])
    downloadCsv(`דוח-יומי-${m}-${cal.y}.csv`, rows)
    notify?.('הדוח היומי יוצא לקובץ', { tone: 'success' })
  }

  return (
    <>
      <IncomeCalendar {...props} d={1} />

      <section className="card card-pad card-in" style={{ '--d': 3 }}>
        <CardHead title="דוח יומי" sub="כל יום בחודש, עם סיכום לכל שבוע · לחיצה על יום פותחת אותו להזנה" icon="calendar">
          <button type="button" className="btn btn--white btn--sm" onClick={exportCsv} disabled={!shown.length}>
            <Icon name="download" /> ייצוא
          </button>
        </CardHead>

        {shown.length === 0 ? (
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
                {w.days.map((x) => (
                  <button key={x.date} type="button" className={`ice-rep-row ice-rep-day ${x.filled ? '' : 'is-empty'} ${x.today ? 'is-today' : ''}`} onClick={() => setOpen(x.d)}>
                    <span className="ice-rep-date">
                      <b>
                        {x.d}/{m}
                      </b>{' '}
                      יום {WEEKDAY[x.wd]}
                    </span>
                    {x.filled ? (
                      <>
                        <span data-l="מזומן">{money(x.cash)}</span>
                        <span data-l="העברה">{money(x.bank)}</span>
                        <span data-l="GROW">{money(x.grow)}</span>
                        <span data-l="אחר">{money(x.other)}</span>
                        <b className="ice-rep-total">{ils(x.total)}</b>
                        <span data-l="הזמנות">{x.orders || '—'}</span>
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
                    <b>שבוע {w.i}</b> {w.days[w.days.length - 1].d}–{w.days[0].d}/{m}
                  </span>
                  <span data-l="מזומן">{money(wsum(w, 'cash'))}</span>
                  <span data-l="העברה">{money(wsum(w, 'bank'))}</span>
                  <span data-l="GROW">{money(wsum(w, 'grow'))}</span>
                  <span data-l="אחר">{money(wsum(w, 'other'))}</span>
                  <b className="ice-rep-total">{ils(wsum(w, 'total'))}</b>
                  <span data-l="הזמנות">{wsum(w, 'orders') || '—'}</span>
                </div>
              </div>
            ))}
            <div className="ice-rep-row ice-rep-month">
              <span className="ice-rep-date">
                <b>סה״כ החודש</b>
              </span>
              <span data-l="מזומן">{money(cal.totals.cash)}</span>
              <span data-l="העברה">{money(cal.totals.bank)}</span>
              <span data-l="GROW">{money(cal.totals.grow)}</span>
              <span data-l="אחר">{money(cal.totals.other)}</span>
              <b className="ice-rep-total">{ils(cal.totals.total)}</b>
              <span data-l="הזמנות">{cal.totals.orders || '—'}</span>
            </div>
            {cal.undated > 0 && <p className="ice-day-note">יש עוד {ils(cal.undated)} מהכנסות החודש בלי תאריך בתוך החודש. הן נספרות בסה״כ, אבל לא ביום מסוים.</p>}
          </div>
        )}
      </section>

      {open && <DayModal key={open} {...props} cal={cal} day={open} setDay={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
