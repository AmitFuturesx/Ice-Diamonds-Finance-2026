/* הכנסות יומיות — the month as a daily dashboard: the calendar (click a day to fill it),
   then a short split of the month by payment method. */
import { useMemo } from 'react'
import Icon from '../Icon'
import { ils } from '../lib'
import { downloadCsv } from './common'
import IncomeCalendar from '../IncomeCalendar'
import { FIELDS, WEEKDAY, buildMonth } from '../dailyIncome'

export { DAILY } from '../dailyIncome'

export default function IncomeDaily(props) {
  const { incomeEntries = [], dailyOrders = [], monthYear, monthNumber, notify } = props
  const cal = useMemo(() => buildMonth({ incomeEntries, dailyOrders, year: monthYear, month: monthNumber }), [incomeEntries, dailyOrders, monthYear, monthNumber])
  const total = cal.totals.total + cal.undated
  const split = [
    ...FIELDS.map((f) => ({ key: f.key, label: f.label, icon: f.icon, tone: f.tone, value: cal.totals[f.key] })),
    { key: 'other', label: 'אחר (מקסימוס, UPS)', icon: 'layers', tone: '#8b979f', value: cal.totals.other + cal.undated }
  ]

  const exportCsv = () => {
    const rows = [['תאריך', 'יום', 'מזומן', 'העברה בנקאית', 'GROW', 'אחר', 'סה״כ', 'הזמנות']]
    for (const x of cal.days.filter((d) => d.past || d.filled)) rows.push([`${x.d}/${cal.m}/${cal.y}`, WEEKDAY[x.wd], x.cash, x.bank, x.grow, x.other, x.total, x.orders])
    rows.push(['סה״כ החודש', '', cal.totals.cash, cal.totals.bank, cal.totals.grow, cal.totals.other, cal.totals.total, cal.totals.orders])
    downloadCsv(`דוח-יומי-${cal.m}-${cal.y}.csv`, rows)
    notify?.('הדוח היומי יוצא לקובץ', { tone: 'success' })
  }

  return (
    <>
      <IncomeCalendar {...props} d={1} title="הלוח היומי של החודש" />

      <section className="card card-pad card-in ice-split" style={{ '--d': 3 }}>
        <div className="ice-split-head">
          <h2 className="sec-title">לפי אמצעי תשלום</h2>
          <button type="button" className="btn btn--white btn--sm" onClick={exportCsv}>
            <Icon name="download" /> ייצוא דוח יומי
          </button>
        </div>
        <div className="ice-split-grid">
          {split.map((s) => {
            const pct = total ? Math.round((s.value / total) * 100) : 0
            return (
              <div key={s.key} className="ice-split-cell" style={{ '--tone': s.tone }}>
                <span>
                  <i className="ice-day-field-ic">
                    <Icon name={s.icon} />
                  </i>
                  {s.label}
                </span>
                <b>{ils(s.value)}</b>
                <div className="ice-bar">
                  <i style={{ width: `${pct}%`, background: s.tone }} />
                </div>
                <small>{pct}% מההכנסות</small>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
