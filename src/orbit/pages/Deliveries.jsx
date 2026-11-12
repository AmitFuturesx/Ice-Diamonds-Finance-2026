/* שליחויות — deliveries with net / VAT / gross, table, and top routes. */
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { CardHead, Empty, Field, FormModal, HBars, Kpi, Menu, PageHead, Pager, SearchInput } from '../kit'
import { ils, ilsK } from '../lib'
import { VAT_RATE } from '../../lib/payroll'
import { Modal, MonthBar, SortBtn, downloadCsv, useSorted } from './common'

const PER = 10
const fmtDate = (s) => {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

export default function Deliveries(props) {
  const { deliveries = [], activeMonthId, months = [], onChangeMonth, onAddMonth, onSaveDelivery, onDeleteDelivery, notify } = props
  const price = (d) => Number(d.price) || 0
  const net = deliveries.reduce((a, d) => a + price(d), 0)
  const vat = net * VAT_RATE
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(null)
  const s = q.trim().toLowerCase()
  const filtered = useMemo(() => deliveries.filter((d) => !s || `${d.route_from} ${d.route_to} ${d.notes || ''}`.toLowerCase().includes(s)), [deliveries, s])
  const sorted = useSorted(filtered, sort, {
    date: (a, b) => String(a.date || '').localeCompare(String(b.date || '')),
    price: (a, b) => price(a) - price(b),
    route: (a, b) => `${a.route_from}${a.route_to}`.localeCompare(`${b.route_from}${b.route_to}`, 'he')
  })
  const pages = Math.max(1, Math.ceil(sorted.length / PER))
  const cur = Math.min(page, pages)
  const rows = sorted.slice((cur - 1) * PER, cur * PER)
  const group = (key) =>
    Object.entries(deliveries.reduce((acc, d) => ((acc[d[key] || '—'] = (acc[d[key] || '—'] || 0) + price(d)), acc), {}))
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

  const exportCsv = () => {
    downloadCsv('שליחויות.csv', [['תאריך', 'מאיפה', 'לאן', 'מחיר נטו', 'הערות'], ...sorted.map((d) => [fmtDate(d.date), d.route_from, d.route_to, price(d), d.notes || ''])])
    notify?.(`יוצאו ${sorted.length} שליחויות`, { tone: 'success' })
  }
  const menuFor = (d) => [
    { id: 'edit', label: 'עריכה', icon: 'edit', onClick: () => setForm(d) },
    { id: 'del', label: 'מחיקה', icon: 'trash', danger: true, onClick: () => onDeleteDelivery(d.id) }
  ]

  return (
    <div className="page">
      <PageHead
        title="שליחויות"
        sub={
          <>
            <b>{deliveries.length}</b> שליחויות החודש · המחירים נרשמים ללא מע״מ
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--white" onClick={exportCsv}>
          <Icon name="download" /> ייצוא
        </button>
        <button className="btn btn--primary" onClick={() => setForm({})}>
          <Icon name="plus" /> שליחות חדשה
        </button>
      </PageHead>

      <div className="grid-kpi">
        <Kpi icon="truck" label="שליחויות החודש" value={deliveries.length} format="num" d={0} />
        <Kpi icon="wallet" label="סה״כ נטו" value={net} tone="teal" d={1} foot="ללא מע״מ" />
        <Kpi icon="receipt" label={`מע״מ (${Math.round(VAT_RATE * 100)}%)`} value={vat} tone="orange" d={2} />
        <Kpi icon="coins" label="לתשלום כולל מע״מ" value={net + vat} tone="purple" d={3} foot={deliveries.length ? `ממוצע ${ils(net / deliveries.length)} לשליחות` : null} />
      </div>

      <section className="card card-pad card-in has-mlist" style={{ '--d': 4 }}>
        <div className="toolbar rv" style={{ '--i': 0 }}>
          <span className="toolbar-spacer" />
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            placeholder="חיפוש מוצא, יעד או הערה"
          />
        </div>
        <div className="tbl-wrap rv" style={{ '--i': 1 }}>
          <div className="tbl" style={{ '--cols': '7rem minmax(13rem, 2fr) 7.5rem minmax(8rem, 1.4fr) 2rem', '--min': '44rem' }}>
            <div className="tbl-row tbl-head">
              <SortBtn k="date" sort={sort} setSort={setSort}>תאריך</SortBtn>
              <SortBtn k="route" sort={sort} setSort={setSort}>מסלול</SortBtn>
              <SortBtn k="price" sort={sort} setSort={setSort}>מחיר נטו</SortBtn>
              <span>הערות</span>
              <span />
            </div>
            <div className="tbl-body">
              {rows.map((d, i) => (
                <div key={d.id} className="tbl-row rv" style={{ '--i': i + 2 }} role="button" tabIndex={0} onClick={() => setForm(d)} onKeyDown={(ev) => ev.key === 'Enter' && setForm(d)}>
                  <span className="tbl-muted">{fmtDate(d.date)}</span>
                  <span className="ice-route">
                    <b>{d.route_from}</b>
                    <Icon name="arrowRight" className="ice-route-arrow" />
                    <b>{d.route_to}</b>
                  </span>
                  <span className="tbl-num">{ils(price(d))}</span>
                  <span className="tbl-muted ice-ellipsis">{d.notes || '—'}</span>
                  <span className="tbl-end">
                    <Menu items={menuFor(d)} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ul className="mlist">
          {rows.map((d) => (
            <li key={d.id} onClick={() => setForm(d)}>
              <div className="mlist-top">
                <span className="avatar avatar--initials ice-av-truck">
                  <Icon name="truck" />
                </span>
                <div className="mlist-main">
                  <b>
                    {d.route_from} ← {d.route_to}
                  </b>
                  <span>
                    {fmtDate(d.date)}
                    {d.notes ? ` · ${d.notes}` : ''}
                  </span>
                </div>
                <b className="mlist-amt">{ils(price(d))}</b>
                <span onClick={(ev) => ev.stopPropagation()}>
                  <Menu items={menuFor(d)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <Empty icon="truck" title={deliveries.length ? 'אין תוצאות' : 'אין עדיין שליחויות בחודש הזה'} text="משלוחים ללקוחות, לספקים ולסדנאות.">
            <button className="btn btn--primary btn--sm" onClick={() => setForm({})}>
              <Icon name="plus" /> שליחות חדשה
            </button>
          </Empty>
        )}
        <Pager page={cur} pages={pages} onChange={setPage} total={sorted.length} label="שליחויות" />
      </section>

      <div className="split split--even">
        <section className="card card-pad card-in" style={{ '--d': 5 }}>
          <CardHead title="יעדים מובילים" sub="לפי סכום נטו" icon="mapPin" />
          {deliveries.length ? <HBars items={group('route_to')} d={5} format={(v) => ilsK(v)} color="var(--teal-2)" /> : <p className="empty">אין עדיין נתונים</p>}
        </section>
        <section className="card card-pad card-in" style={{ '--d': 6 }}>
          <CardHead title="נקודות מוצא" sub="מאיפה יוצאים הכי הרבה" icon="building" />
          {deliveries.length ? <HBars items={group('route_from')} d={6} format={(v) => ilsK(v)} /> : <p className="empty">אין עדיין נתונים</p>}
        </section>
      </div>

      {form && (
        <Modal label="טופס שליחות" onClose={() => setForm(null)}>
          {(close) => (
            <DeliveryForm
              initial={form.id ? form : null}
              close={close}
              onDelete={form.id ? () => onDeleteDelivery(form.id) : null}
              onSave={async (v) => {
                const base = { date: v.date || new Date().toISOString().split('T')[0], route_from: v.from, route_to: v.to, price: v.price, notes: v.notes }
                if (form.id) await onSaveDelivery({ ...form, ...base })
                else await onSaveDelivery({ month_id: activeMonthId, ...base })
                notify?.(form.id ? 'השליחות עודכנה' : 'נוספה שליחות', { tone: 'success' })
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function DeliveryForm({ initial, close, onSave, onDelete }) {
  const [v, setV] = useState(() => ({ date: initial?.date || '', from: initial?.route_from || '', to: initial?.route_to || '', price: initial ? String(initial.price ?? '') : '', notes: initial?.notes || '' }))
  const [err, setErr] = useState({})
  const submit = () => {
    const e = {}
    if (!v.from.trim()) e.from = 'מאיפה?'
    if (!v.to.trim()) e.to = 'לאן?'
    if (v.price === '' || !(Number(v.price) >= 0)) e.price = 'צריך מחיר'
    setErr(e)
    if (Object.keys(e).length) return
    onSave({ ...v, from: v.from.trim(), to: v.to.trim(), price: Number(v.price) || 0 })
    close()
  }
  return (
    <FormModal
      title={initial ? 'עריכת שליחות' : 'שליחות חדשה'}
      sub="מחיר נטו, ללא מע״מ"
      icon={initial ? 'edit' : 'truck'}
      close={close}
      onSubmit={submit}
      submitLabel={initial ? 'שמירת שינויים' : 'הוספה'}
      extra={
        onDelete && (
          <button type="button" className="btn btn--danger ice-push" onClick={() => { close(); onDelete() }}>
            <Icon name="trash" /> מחיקה
          </button>
        )
      }
    >
      <Field label="מאיפה *" error={err.from}>
        <input value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} placeholder="לדוגמה: החנות" autoFocus />
      </Field>
      <Field label="לאן *" error={err.to}>
        <input value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} placeholder="לדוגמה: לקוח בתל אביב" />
      </Field>
      <Field label="מחיר נטו (₪) *" error={err.price}>
        <input inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} placeholder="0" />
      </Field>
      <Field label="תאריך" hint="ריק = היום">
        <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
      </Field>
      <Field label="הערות" full>
        <textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="לא חובה" />
      </Field>
    </FormModal>
  )
}
