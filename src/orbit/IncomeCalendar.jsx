/* Daily income calendar (top of the dashboard, and the income page).
   A month grid, Sunday → Saturday, with a weekly-summary column. Each day shows what came in;
   today is outlined; a past day with nothing filled has an orange dot.
   Clicking a day opens a small popup: cash / bank transfer / GROW / orders → save. */
import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { compact, ils } from './lib'
import { Modal } from './pages/common'
import { FIELDS, MONTH_NAME, WEEKDAY, WEEKDAY_FULL, buildMonth, dailyEntryOf, n0, saveDay } from './dailyIncome'

const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`

export default function IncomeCalendar(props) {
  const { incomeEntries = [], dailyOrders = [], monthYear, monthNumber, months = [], activeMonthId, onChangeMonth, notify, d = 0, title = 'הכנסות יומיות' } = props
  const cal = useMemo(() => buildMonth({ incomeEntries, dailyOrders, year: monthYear, month: monthNumber }), [incomeEntries, dailyOrders, monthYear, monthNumber])
  const [open, setOpen] = useState(null) // day number

  const sorted = [...months].sort((a, b) => a.year - b.year || a.month_number - b.month_number)
  const idx = sorted.findIndex((x) => x.id === activeMonthId)
  const prevMonth = idx > 0 ? sorted[idx - 1] : null
  const nextMonth = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null
  const avg = cal.filled.length ? cal.totals.total / cal.filled.length : 0

  return (
    <section className="card ice-cal card-in" style={{ '--d': d }}>
      <header className="ice-cal-head">
        <div className="ice-cal-title">
          <h2>{title}</h2>
          <div className="ice-cal-month">
            <button type="button" className="icon-btn icon-btn--soft" disabled={!prevMonth} onClick={() => prevMonth && onChangeMonth?.(prevMonth.id)} aria-label="חודש קודם">
              <Icon name="chevronRight" />
            </button>
            <b>
              {MONTH_NAME[cal.m]} {cal.y}
            </b>
            <button type="button" className="icon-btn icon-btn--soft" disabled={!nextMonth} onClick={() => nextMonth && onChangeMonth?.(nextMonth.id)} aria-label="חודש הבא">
              <Icon name="chevronLeft" />
            </button>
          </div>
        </div>
        <div className="ice-cal-stats">
          <div className="is-main">
            <span>נכנס החודש</span>
            <b>{ils(cal.totals.total + cal.undated)}</b>
          </div>
          <div>
            <span>הזמנות</span>
            <b>{cal.totals.orders}</b>
          </div>
          <div>
            <span>ממוצע ליום</span>
            <b>{ils(avg)}</b>
          </div>
          <div>
            <span>ימים שמולאו</span>
            <b>
              {cal.filled.length}
              <small>/{cal.lastDay || cal.daysInMonth}</small>
            </b>
          </div>
        </div>
      </header>

      <div className="ice-cal-grid" role="grid" aria-label={`הכנסות ${MONTH_NAME[cal.m]}`}>
        {WEEKDAY_FULL.map((w) => (
          <span key={w} className="ice-cal-wd" role="columnheader">
            <i className="ice-hide-sm">{w}</i>
            <i className="ice-show-sm">{WEEKDAY[WEEKDAY_FULL.indexOf(w)]}</i>
          </span>
        ))}
        <span className="ice-cal-wd ice-cal-wsum-h" role="columnheader">
          סיכום שבועי
        </span>

        {cal.weeks.map((w, wi) => (
          <div key={wi} className="ice-cal-row" role="row">
            {w.cells.map((c, ci) =>
              c ? (
                <button
                  key={c.d}
                  type="button"
                  role="gridcell"
                  className={`ice-cal-day ${c.filled ? 'is-filled' : ''} ${c.today ? 'is-today' : ''} ${c.future ? 'is-future' : ''} ${c.past && !c.filled ? 'is-missing' : ''}`}
                  disabled={c.future}
                  onClick={() => setOpen(c.d)}
                  aria-label={`${c.d} ב${MONTH_NAME[cal.m]}: ${c.filled ? ils(c.total) : 'לא מולא'}`}
                >
                  <span className="ice-cal-num">{c.d}</span>
                  {c.filled ? (
                    <>
                      <b className="ice-cal-amt">
                        <i className="ice-hide-sm">{ils(c.total)}</i>
                        <i className="ice-show-sm">{c.total ? compact(c.total) : '—'}</i>
                      </b>
                      {c.orders > 0 && <small className="ice-cal-ord">{pl(c.orders, 'הזמנה', 'הזמנות')}</small>}
                    </>
                  ) : c.today ? (
                    <span className="ice-cal-add">
                      <Icon name="plus" /> <i className="ice-hide-sm">הוספה</i>
                    </span>
                  ) : c.past ? (
                    <i className="ice-cal-dot" aria-hidden="true" />
                  ) : null}
                </button>
              ) : (
                <span key={`x${ci}`} className="ice-cal-day is-blank" aria-hidden="true" />
              )
            )}
            <div className={`ice-cal-wsum ${w.total ? 'has' : ''}`}>
              <b>{ils(w.total)}</b>
              <small>{pl(w.orders, 'הזמנה', 'הזמנות')}</small>
            </div>
          </div>
        ))}
      </div>
      <p className="ice-cal-hint">
        <i className="ice-cal-dot" /> יום שעבר ולא מולא · לחיצה על יום פותחת אותו להזנה
      </p>

      {open && (
        <DayModal
          key={open}
          cal={cal}
          day={open}
          setDay={setOpen}
          {...props}
          incomeEntries={incomeEntries}
          dailyOrders={dailyOrders}
          notify={notify}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/* ============================================================== */
/* Quick entry for one day                                         */
export function DayModal({ cal, day, setDay, onClose, incomeEntries, dailyOrders, activeMonthId, onSaveIncome, onDeleteIncome, onSaveDailyOrders, notify }) {
  const info = cal.days[day - 1]
  const date = info.date
  const load = () => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, dailyEntryOf(incomeEntries, date, f.source) ? String(n0(dailyEntryOf(incomeEntries, date, f.source).amount)) : ''])),
    orders: (() => {
      const o = dailyOrders.find((x) => String(x.date).slice(0, 10) === date)
      return o && n0(o.orders) ? String(n0(o.orders)) : ''
    })()
  })
  const [vals, setVals] = useState(load)
  const [busy, setBusy] = useState(false)
  const firstRef = useRef(null)
  useEffect(() => {
    setVals(load())
    window.setTimeout(() => firstRef.current?.focus(), 60)
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = FIELDS.reduce((a, f) => a + n0(vals[f.key]), 0)
  const orders = n0(vals.orders)
  const others = info.entries.filter((e) => e.channel !== 'יומי')
  const othersSum = others.reduce((a, e) => a + n0(e.amount), 0)
  const already = FIELDS.some((f) => dailyEntryOf(incomeEntries, date, f.source)) || dailyOrders.some((x) => String(x.date).slice(0, 10) === date)
  const canPrev = day > 1
  const canNext = day < (cal.lastDay || cal.daysInMonth)

  const save = async (close) => {
    if (busy) return
    setBusy(true)
    const ok = await saveDay({ date, vals, incomeEntries, dailyOrders, activeMonthId, onSaveIncome, onDeleteIncome, onSaveDailyOrders })
    setBusy(false)
    if (!ok) return
    notify?.(`נשמר ${info.d}/${cal.m}: ${ils(total + othersSum)}${orders ? ` · ${pl(orders, 'הזמנה', 'הזמנות')}` : ''}`, { tone: 'success' })
    close()
  }

  return (
    <Modal label={`הכנסות ${info.d}/${cal.m}`} onClose={onClose} className="ice-pop ice-daypop">
      {(close) => (
        <form
          className="ice-pop-in"
          onSubmit={(e) => {
            e.preventDefault()
            save(close)
          }}
        >
          <header className="ice-daypop-head">
            <button type="button" className="icon-btn icon-btn--soft" disabled={!canPrev} onClick={() => setDay(day - 1)} aria-label="יום קודם">
              <Icon name="chevronRight" />
            </button>
            <div>
              <h2>
                יום {WEEKDAY_FULL[info.wd]}, {info.d} ב{MONTH_NAME[cal.m]}
              </h2>
              <p>{info.today ? 'היום' : already ? 'כבר מולא · אפשר לתקן' : 'כמה כסף נכנס ביום הזה?'}</p>
            </div>
            <button type="button" className="icon-btn icon-btn--soft" disabled={!canNext} onClick={() => setDay(day + 1)} aria-label="יום הבא">
              <Icon name="chevronLeft" />
            </button>
          </header>

          <div className="ice-day-fields">
            {FIELDS.map((f, i) => (
              <label key={f.key} className="ice-day-field" style={{ '--tone': f.tone }}>
                <span>
                  <i className="ice-day-field-ic">
                    <Icon name={f.icon} />
                  </i>
                  {f.label}
                </span>
                <div className="ice-day-input">
                  <em>₪</em>
                  <input ref={i === 0 ? firstRef : undefined} inputMode="decimal" value={vals[f.key]} placeholder="0" onChange={(e) => setVals({ ...vals, [f.key]: e.target.value.replace(/[^\d.]/g, '') })} />
                </div>
              </label>
            ))}
            <label className="ice-day-field" style={{ '--tone': '#3f9163' }}>
              <span>
                <i className="ice-day-field-ic">
                  <Icon name="receipt" />
                </i>
                מספר הזמנות
              </span>
              <div className="ice-day-input">
                <em>#</em>
                <input inputMode="numeric" value={vals.orders} placeholder="0" onChange={(e) => setVals({ ...vals, orders: e.target.value.replace(/\D/g, '') })} />
              </div>
            </label>
          </div>

          <div className="ice-day-sum">
            <div>
              <span>סה״כ נכנס ביום הזה</span>
              <b>{ils(total + othersSum)}</b>
            </div>
            {orders > 0 && (
              <div>
                <span>ממוצע להזמנה</span>
                <b>{ils((total + othersSum) / orders)}</b>
              </div>
            )}
          </div>
          {othersSum > 0 && (
            <p className="ice-day-note">
              כולל עוד {ils(othersSum)} מרשומות אחרות ביום הזה ({others.map((e) => e.source).join(', ')}).
            </p>
          )}

          <div className="ice-daypop-actions">
            <button type="submit" className="btn btn--primary ice-day-save" disabled={busy}>
              <Icon name="check" /> {busy ? 'שומר...' : 'שמירה'}
            </button>
            <button type="button" className="btn btn--white ice-day-save" onClick={close}>
              ביטול
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
