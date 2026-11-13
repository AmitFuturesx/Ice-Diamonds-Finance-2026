/* הכנסות — KPI row, entries table by source, and the source mix + six-month trend. */
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { BarChart, CardHead, DonutMulti, Empty, Field, FormModal, Kpi, Menu, PageHead, Pager, Pill, Segmented, Select } from '../kit'
import { compact, ils, ilsK, pctChange } from '../lib'
import { Modal, MonthBar, SortBtn, downloadCsv, seriesOf, useHistory, useSorted } from './common'
import IncomeDaily from './IncomeDaily'

const SOURCES = ['מקסימוס', 'UPS', 'מזומן', 'העברה בנקאית', 'משולם / GROW']
const SOURCE_COLOR = { 'מקסימוס': '#6cc06a', UPS: '#2c6d85', 'מזומן': '#f0a43c', 'העברה בנקאית': '#a65ad6', 'משולם / GROW': '#3a87a0' }
const SOURCE_TONE = { 'מקסימוס': 'green', UPS: 'teal', 'מזומן': 'orange', 'העברה בנקאית': 'purple', 'משולם / GROW': 'teal' }
const SHORT_MONTH = ['', 'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const PER = 10
const fmtDate = (s) => {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

export default function Income(props) {
  const { incomeEntries = [], dailyOrders = [], activeMonthId, months = [], monthYear, monthNumber, onChangeMonth, onAddMonth, onSaveIncome, onDeleteIncome, onSaveDailyOrders, notify } = props
  const [view, setView] = useState('daily')
  const amt = (e) => Number(e.amount) || 0
  const total = incomeEntries.reduce((a, e) => a + amt(e), 0)
  const bySource = SOURCES.map((s) => ({ id: s, value: incomeEntries.filter((e) => e.source === s).reduce((a, e) => a + amt(e), 0), n: incomeEntries.filter((e) => e.source === s).length }))
  const lead = [...bySource].sort((a, b) => b.value - a.value)[0]
  const { win, hist } = useHistory(months, activeMonthId)
  const spark = seriesOf(win, hist, activeMonthId, 'income', total)
  const prev = spark.length > 1 ? spark[spark.length - 2] : null

  const [source, setSource] = useState('all')
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(null)
  const filtered = useMemo(() => incomeEntries.filter((e) => source === 'all' || e.source === source), [incomeEntries, source])
  const sorted = useSorted(filtered, sort, {
    date: (a, b) => String(a.date || '').localeCompare(String(b.date || '')),
    amount: (a, b) => amt(a) - amt(b),
    source: (a, b) => a.source.localeCompare(b.source, 'he')
  })
  const pages = Math.max(1, Math.ceil(sorted.length / PER))
  const cur = Math.min(page, pages)
  const rows = sorted.slice((cur - 1) * PER, cur * PER)

  const exportCsv = () => {
    downloadCsv('הכנסות.csv', [['תאריך', 'מקור', 'סכום'], ...sorted.map((e) => [fmtDate(e.date), e.source, amt(e)])])
    notify?.(`יוצאו ${sorted.length} שורות`, { tone: 'success' })
  }
  const menuFor = (e) => [
    { id: 'edit', label: 'עריכה', icon: 'edit', onClick: () => setForm(e) },
    { id: 'del', label: 'מחיקה', icon: 'trash', danger: true, onClick: () => onDeleteIncome(e.id) }
  ]
  const trendSeries = useMemo(() => [{ id: 'inc', label: 'הכנסות', color: 'var(--green)', data: spark }], [spark.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page">
      <PageHead
        title="הכנסות"
        sub={
          <>
            <b>{incomeEntries.length}</b> רשומות החודש · סה״כ <b>{ils(total)}</b>
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--white" onClick={exportCsv}>
          <Icon name="download" /> ייצוא
        </button>
        <button className="btn btn--primary" onClick={() => setForm({})}>
          <Icon name="plus" /> הכנסה חדשה
        </button>
      </PageHead>

      <div className="ice-view-switch rv" style={{ '--i': 3 }}>
        <Segmented
          label="תצוגה"
          value={view}
          onChange={setView}
          options={[
            { id: 'daily', label: 'דוח יומי', icon: 'calendar' },
            { id: 'sources', label: 'כל הרשומות', icon: 'file' }
          ]}
        />
      </div>

      {view === 'daily' && (
        <IncomeDaily
          incomeEntries={incomeEntries}
          dailyOrders={dailyOrders}
          monthYear={monthYear}
          monthNumber={monthNumber}
          activeMonthId={activeMonthId}
          onSaveIncome={onSaveIncome}
          onDeleteIncome={onDeleteIncome}
          onSaveDailyOrders={onSaveDailyOrders}
          notify={notify}
        />
      )}

      {view === 'sources' && (
      <>
      <div className="grid-kpi">
        <Kpi icon="coins" label="הכנסות החודש" value={total} spark={spark} delta={prev ? pctChange(total, prev) : null} d={0} foot={prev != null ? `בחודש הקודם ${ils(prev)}` : null} />
        <Kpi icon="star" label="המקור המוביל" value={lead?.value || 0} tone="teal" d={1} foot={lead?.value ? `${lead.id} · ${total ? Math.round((lead.value / total) * 100) : 0}% מההכנסות` : 'אין עדיין הכנסות'} onClick={lead?.value ? () => setSource(lead.id) : undefined} />
        <Kpi icon="file" label="מספר רשומות" value={incomeEntries.length} format="num" tone="purple" d={2} foot={`${bySource.filter((s) => s.n).length} מקורות פעילים`} />
        <Kpi icon="trendUp" label="ממוצע לרשומה" value={incomeEntries.length ? total / incomeEntries.length : 0} tone="orange" d={3} />
      </div>

      <section className="card card-pad card-in has-mlist" style={{ '--d': 4 }}>
        <div className="toolbar rv" style={{ '--i': 0 }}>
          <Segmented
            label="מקור"
            value={source}
            onChange={(v) => {
              setSource(v)
              setPage(1)
            }}
            options={[{ id: 'all', label: 'הכל', count: incomeEntries.length }, ...bySource.map((s) => ({ id: s.id, label: s.id === 'משולם / GROW' ? 'GROW' : s.id === 'העברה בנקאית' ? 'העברה' : s.id, count: s.n }))]}
          />
        </div>
        <div className="tbl-wrap rv" style={{ '--i': 1 }}>
          <div className="tbl" style={{ '--cols': '8rem minmax(10rem, 1.6fr) minmax(8rem, 1fr) 2rem', '--min': '34rem' }}>
            <div className="tbl-row tbl-head">
              <SortBtn k="date" sort={sort} setSort={setSort}>תאריך</SortBtn>
              <SortBtn k="source" sort={sort} setSort={setSort}>מקור</SortBtn>
              <SortBtn k="amount" sort={sort} setSort={setSort}>סכום</SortBtn>
              <span />
            </div>
            <div className="tbl-body">
              {rows.map((e, i) => (
                <div key={e.id} className="tbl-row rv" style={{ '--i': i + 2 }} role="button" tabIndex={0} onClick={() => setForm(e)} onKeyDown={(ev) => ev.key === 'Enter' && setForm(e)}>
                  <span className="tbl-muted">{fmtDate(e.date)}</span>
                  <span>
                    <Pill tone={SOURCE_TONE[e.source] || 'grey'}>{e.source}</Pill>
                  </span>
                  <span className="tbl-num">{ils(amt(e))}</span>
                  <span className="tbl-end">
                    <Menu items={menuFor(e)} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ul className="mlist">
          {rows.map((e) => (
            <li key={e.id} onClick={() => setForm(e)}>
              <div className="mlist-top">
                <span className="avatar avatar--initials" style={{ background: SOURCE_COLOR[e.source] }}>
                  <Icon name="coins" />
                </span>
                <div className="mlist-main">
                  <b>{e.source}</b>
                  <span>{fmtDate(e.date)}</span>
                </div>
                <b className="mlist-amt">{ils(amt(e))}</b>
                <span onClick={(ev) => ev.stopPropagation()}>
                  <Menu items={menuFor(e)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <Empty icon="coins" title={incomeEntries.length ? 'אין הכנסות מהמקור הזה' : 'אין עדיין הכנסות בחודש הזה'} text="מקסימוס, UPS, מזומן, העברה בנקאית ומשולם / GROW.">
            <button className="btn btn--primary btn--sm" onClick={() => setForm({})}>
              <Icon name="plus" /> הכנסה חדשה
            </button>
          </Empty>
        )}
        <Pager page={cur} pages={pages} onChange={setPage} total={sorted.length} label="רשומות" />
      </section>

      <div className="split split--even">
        <section className="card card-pad card-in" style={{ '--d': 5 }}>
          <CardHead title="פילוח לפי מקור" sub="איך ההכנסות של החודש מתחלקות" icon="pie" />
          {total > 0 ? (
            <DonutMulti items={bySource.map((s) => ({ label: s.id, value: s.value, color: SOURCE_COLOR[s.id] }))} size="9.5rem" thickness={14} d={5} format={(v) => ilsK(v)} title="הכנסות" />
          ) : (
            <p className="empty">אין עדיין נתונים</p>
          )}
        </section>
        <section className="card card-pad card-in" style={{ '--d': 6 }}>
          <CardHead title="מגמה" sub="הכנסות בחצי השנה האחרונה" icon="bars" />
          {win.length > 0 ? <BarChart labels={win.map((m) => SHORT_MONTH[m.month_number] || m.name)} series={trendSeries} height="13rem" d={6} format={(v) => `₪${compact(v)}`} /> : <p className="empty">אין עדיין היסטוריה</p>}
        </section>
      </div>
      </>
      )}

      {form && (
        <Modal label="טופס הכנסה" onClose={() => setForm(null)}>
          {(close) => (
            <IncomeForm
              initial={form.id ? form : null}
              close={close}
              onDelete={form.id ? () => onDeleteIncome(form.id) : null}
              onSave={async (v) => {
                const base = { source: v.source, amount: v.amount, channel: 'חודשי', date: v.date || new Date().toISOString().split('T')[0] }
                if (form.id) await onSaveIncome({ ...form, ...base })
                else await onSaveIncome({ month_id: activeMonthId, ...base })
                notify?.(form.id ? 'ההכנסה עודכנה' : `נוספה הכנסה: ${ils(v.amount)}`, { tone: 'success' })
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function IncomeForm({ initial, close, onSave, onDelete }) {
  const [v, setV] = useState(() => ({ source: initial?.source || 'מקסימוס', amount: initial ? String(initial.amount ?? '') : '', date: initial?.date || '' }))
  const [err, setErr] = useState({})
  const submit = () => {
    const e = {}
    if (v.amount === '' || !(Number(v.amount) >= 0)) e.amount = 'צריך סכום'
    setErr(e)
    if (Object.keys(e).length) return
    onSave({ ...v, amount: Number(v.amount) || 0 })
    close()
  }
  return (
    <FormModal
      title={initial ? 'עריכת הכנסה' : 'הכנסה חדשה'}
      sub={initial ? initial.source : 'ההכנסות נרשמות לחודש הפתוח'}
      icon={initial ? 'edit' : 'coins'}
      close={close}
      onSubmit={submit}
      submitLabel={initial ? 'שמירת שינויים' : 'הוספה'}
      extra={
        onDelete && (
          <button
            type="button"
            className="btn btn--danger ice-push"
            onClick={() => {
              close()
              onDelete()
            }}
          >
            <Icon name="trash" /> מחיקה
          </button>
        )
      }
    >
      <Field label="מקור">
        <Select value={v.source} options={SOURCES.map((s) => ({ id: s, label: s, dot: SOURCE_COLOR[s] }))} onChange={(s) => setV({ ...v, source: s })} />
      </Field>
      <Field label="סכום (₪) *" error={err.amount}>
        <input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0" autoFocus />
      </Field>
      <Field label="תאריך" hint="ריק = היום" full>
        <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
      </Field>
    </FormModal>
  )
}
