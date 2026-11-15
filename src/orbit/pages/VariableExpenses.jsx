/* הוצאות משתנות — permanent suppliers, each with this month's purchases.
   Every purchase has its own date, before-VAT / VAT / total, payment status and invoice (→ morning).
   A supplier with no purchases this month shows ₪0 and needs no invoice. */
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { Chips, Empty, Field, FormModal, Kpi, Menu, PageHead, SearchInput, Segmented, Select, StatusPill, nextStatus } from '../kit'
import { ils } from '../lib'
import { VAT_RATE } from '../../lib/payroll'
import { Modal, MonthBar, downloadCsv } from './common'
import { useInvoiceRows } from '../invoiceUpload'

const n0 = (v) => Number(v) || 0
const r2 = (v) => Math.round(v * 100) / 100
const pad = (n) => String(n).padStart(2, '0')
const fmt = (s) => {
  const p = String(s || '').slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : '—'
}
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`
const NO_SUPPLIER = '__none__'

/** before VAT / VAT / total of one purchase */
export function vatSplit(row, exempt) {
  const total = n0(row.amount)
  const vat = row.vat_amount != null && row.vat_amount !== '' ? n0(row.vat_amount) : exempt ? 0 : r2(total - total / (1 + VAT_RATE))
  return { total, vat, net: r2(total - vat) }
}

export default function VariableExpenses(props) {
  const { expenses = [], suppliers = [], activeMonthId, months = [], monthYear, monthNumber, onChangeMonth, onAddMonth, onSaveExpense, onDeleteExpense, onSaveSupplier, notify, userEmail, onNavigate } = props
  const inv = useInvoiceRows({ notify, userEmail })
  const [q, setQ] = useState('')
  const [show, setShow] = useState('active')
  const [open, setOpen] = useState({}) // supplier id → expanded
  const [form, setForm] = useState(null) // { purchase?, supplierId? }
  const [supForm, setSupForm] = useState(null) // supplier object or {}

  /* ---------- group this month's purchases under their supplier ---------- */
  const groups = useMemo(() => {
    const byId = Object.fromEntries(suppliers.map((s) => [s.id, s]))
    const byName = Object.fromEntries(suppliers.map((s) => [s.name.trim(), s]))
    const map = {}
    for (const s of suppliers) map[s.id] = { supplier: s, purchases: [] }
    for (const e of expenses) {
      const s = (e.supplier_id && byId[e.supplier_id]) || byName[String(e.name || '').trim()]
      const key = s ? s.id : NO_SUPPLIER
      if (!map[key]) map[key] = { supplier: { id: NO_SUPPLIER, name: 'הוצאות בלי ספק', vat_exempt: false, active: true }, purchases: [] }
      if (n0(e.amount) > 0 || e.description) map[key].purchases.push(e) // a ₪0 placeholder row is just the old "supplier line"
    }
    return Object.values(map)
      .map((g) => {
        const rows = [...g.purchases].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
        const split = rows.map((p) => vatSplit(p, g.supplier.vat_exempt))
        const total = split.reduce((a, x) => a + x.total, 0)
        const vat = split.reduce((a, x) => a + x.vat, 0)
        const left = rows.filter((p) => p.status !== 'שולם').reduce((a, p) => a + n0(p.amount), 0)
        const missing = rows.filter((p) => n0(p.amount) > 0 && !['sent', 'skipped'].includes(inv.invoiceFor(activeMonthId, 'variable', p.id)?.state)).length
        return { ...g, purchases: rows, total, vat, net: r2(total - vat), left, missing }
      })
      .filter((g) => g.supplier.active !== false || g.purchases.length)
      .sort((a, b) => Number(b.purchases.length > 0) - Number(a.purchases.length > 0) || b.total - a.total || a.supplier.name.localeCompare(b.supplier.name, 'he'))
  }, [expenses, suppliers, inv.rows, activeMonthId]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = q.trim().toLowerCase()
  const matches = (g) => g.supplier.name.toLowerCase().includes(s) || g.purchases.some((p) => String(p.description || '').toLowerCase().includes(s))
  const visible = groups.filter((g) => (s ? matches(g) : show === 'all' || g.purchases.length > 0))
  const empty = groups.filter((g) => !g.purchases.length)
  const total = groups.reduce((a, g) => a + g.total, 0)
  const vat = groups.reduce((a, g) => a + g.vat, 0)
  const left = groups.reduce((a, g) => a + g.left, 0)
  const count = groups.reduce((a, g) => a + g.purchases.length, 0)
  const missing = groups.reduce((a, g) => a + g.missing, 0)
  const isOpen = (g) => open[g.supplier.id] ?? (g.purchases.length > 0 && g.purchases.length <= 8)

  const setStatus = (p, next) => {
    const prev = p.status
    onSaveExpense({ ...p, status: next })
    if (next === 'שולם') notify?.(`סומן כשולם: ${p.name}${p.description ? ` · ${p.description}` : ''}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => onSaveExpense({ ...p, status: prev }) } })
  }
  const invItem = (g, p) => ({ monthId: activeMonthId, kind: 'variable', id: p.id, name: `${g.supplier.name} · ${fmt(p.date)}${p.description ? ` ${p.description}` : ''}` })

  const exportCsv = () => {
    const rows = [['ספק', 'תאריך', 'תיאור', 'לפני מע״מ', 'מע״מ', 'סה״כ', 'סטטוס', 'חשבונית']]
    for (const g of groups)
      for (const p of g.purchases) {
        const v = vatSplit(p, g.supplier.vat_exempt)
        rows.push([g.supplier.name, fmt(p.date), p.description || '', v.net, v.vat, v.total, p.status, inv.invoiceFor(activeMonthId, 'variable', p.id)?.state === 'sent' ? 'יש' : 'חסרה'])
      }
    downloadCsv('הוצאות-משתנות.csv', rows)
    notify?.(`יוצאו ${count} רכישות`, { tone: 'success' })
  }

  return (
    <div className="page ice-var">
      <PageHead
        title="הוצאות משתנות"
        sub={
          <>
            <b>{pl(count, 'רכישה', 'רכישות')}</b> החודש אצל {pl(groups.filter((g) => g.purchases.length).length, 'ספק', 'ספקים')} · סה״כ <b>{ils(total)}</b>
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--white" onClick={exportCsv}>
          <Icon name="download" /> ייצוא
        </button>
        <button className="btn btn--white" onClick={() => setSupForm({})}>
          <Icon name="userPlus" /> ספק חדש
        </button>
        <button className="btn btn--primary" onClick={() => setForm({})}>
          <Icon name="plus" /> רכישה חדשה
        </button>
      </PageHead>

      <div className="grid-kpi">
        <Kpi icon="card" label="סה״כ החודש (כולל מע״מ)" value={total} tone="purple" d={0} foot={`לפני מע״מ ${ils(total - vat)} · מע״מ ${ils(vat)}`} />
        <Kpi icon="clock" label="נותר לשלם" value={left} tone="orange" d={1} foot={left ? 'רכישות שעוד לא שולמו' : 'הכל שולם'} />
        <Kpi icon="receipt" label="רכישות החודש" value={count} format="num" tone="teal" d={2} foot={`${pl(suppliers.length, 'ספק קבוע', 'ספקים קבועים')} ברשימה`} />
        <Kpi icon="file" label="חסרות חשבוניות" value={missing} format="num" tone={missing ? 'red' : 'green'} d={3} foot={missing ? 'העלאה ישר מהרכישה' : 'לכל הרכישות יש חשבונית'} />
      </div>

      <section className="card card-pad card-in" style={{ '--d': 4 }}>
        <div className="toolbar">
          <Segmented
            label="תצוגה"
            value={show}
            onChange={setShow}
            options={[
              { id: 'active', label: 'עם רכישות החודש', count: groups.filter((g) => g.purchases.length).length },
              { id: 'all', label: 'כל הספקים', count: groups.length }
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="חיפוש ספק או רכישה" />
        </div>

        <div className="ice-sup-list">
          {visible.map((g) => {
            const expanded = isOpen(g)
            const sup = g.supplier
            return (
              <div key={sup.id} className={`ice-sup ${g.purchases.length ? '' : 'is-empty'} ${expanded ? 'is-open' : ''}`}>
                <div className="ice-sup-head">
                  <button type="button" className="ice-sup-toggle" onClick={() => setOpen((o) => ({ ...o, [sup.id]: !expanded }))} aria-expanded={expanded}>
                    <span className="avatar avatar--initials ice-sup-av">{sup.name.trim().slice(0, 1)}</span>
                    <span className="ice-sup-name">
                      <b>{sup.name}</b>
                      <small>
                        {g.purchases.length ? pl(g.purchases.length, 'רכישה', 'רכישות') : 'אין רכישות החודש'}
                        {sup.vat_exempt ? ' · פטור ממע״מ' : ''}
                      </small>
                    </span>
                    <Icon name="chevronDown" className={`chev ${expanded ? 'is-up' : ''}`} />
                  </button>
                  <div className="ice-sup-sums">
                    <span>
                      <small>לפני מע״מ</small>
                      {ils(g.net)}
                    </span>
                    <span>
                      <small>מע״מ</small>
                      {ils(g.vat)}
                    </span>
                    <b>
                      <small>סה״כ</small>
                      {ils(g.total)}
                    </b>
                  </div>
                  <div className="ice-sup-flags">
                    {g.left > 0 && <span className="ice-need-badge is-missing">נותר {ils(g.left)}</span>}
                    {g.missing > 0 && <span className="ice-need-badge is-failed">{g.missing === 1 ? 'חסרה חשבונית' : `חסרות ${g.missing} חשבוניות`}</span>}
                    {g.purchases.length > 0 && !g.missing && <span className="ice-need-badge is-done">כל החשבוניות</span>}
                  </div>
                  <div className="ice-sup-actions">
                    {sup.id !== NO_SUPPLIER && (
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => setForm({ supplierId: sup.id })}>
                        <Icon name="plus" /> רכישה
                      </button>
                    )}
                    {sup.id !== NO_SUPPLIER && (
                      <Menu
                        items={[
                          { id: 'edit', label: 'עריכת ספק', icon: 'edit', onClick: () => setSupForm(sup) },
                          { id: 'hide', label: sup.active === false ? 'החזרה לרשימה' : 'הסתרה מהרשימה', icon: 'eye', onClick: () => onSaveSupplier({ ...sup, active: sup.active === false }) }
                        ]}
                      />
                    )}
                  </div>
                </div>

                {expanded && g.purchases.length > 0 && (
                  <ul className="ice-buy-list">
                    <li className="ice-buy ice-buy-headrow" aria-hidden="true">
                      <span>תאריך</span>
                      <span>תיאור</span>
                      <span>לפני מע״מ</span>
                      <span>מע״מ</span>
                      <span>סה״כ</span>
                      <span>תשלום</span>
                      <span>חשבונית</span>
                      <span />
                    </li>
                    {g.purchases.map((p) => {
                      const v = vatSplit(p, sup.vat_exempt)
                      const doc = inv.invoiceFor(activeMonthId, 'variable', p.id)
                      return (
                        <li key={p.id} className={`ice-buy ${p.status === 'שולם' ? 'is-paid' : ''}`}>
                          <span className="ice-buy-date">{fmt(p.date)}</span>
                          <span className="ice-buy-desc">{p.description || <i>ללא תיאור</i>}</span>
                          <span data-l="לפני מע״מ">{ils(v.net, 2)}</span>
                          <span data-l="מע״מ">{ils(v.vat, 2)}</span>
                          <b className="ice-buy-total">{ils(v.total, 2)}</b>
                          <span className="ice-buy-status">
                            <StatusPill status={p.status} onClick={() => setStatus(p, nextStatus(p.status))} />
                          </span>
                          <span className="ice-buy-doc">
                            {doc?.state === 'sent' && (
                              <span className="ice-need-badge is-done" title={doc.file_name}>
                                <Icon name="check" /> חשבונית
                              </span>
                            )}
                            {doc?.state === 'pending' && (
                              <span className="ice-need-badge is-pending">
                                <span className="ice-spin" /> שולח
                              </span>
                            )}
                            {doc?.state === 'skipped' && <span className="ice-need-badge is-skipped">לא צריך</span>}
                            {doc?.state === 'failed' && (
                              <button type="button" className="ice-need-badge is-failed ice-doc-btn" onClick={() => inv.retry(doc)} title={doc.error || ''}>
                                <Icon name="refresh" /> שלח שוב
                              </button>
                            )}
                            {!doc && (
                              <button type="button" className="btn btn--white btn--sm" onClick={() => inv.pick(invItem(g, p))}>
                                <Icon name="upload" /> העלאה
                              </button>
                            )}
                          </span>
                          <span className="ice-buy-menu">
                            <Menu
                              items={[
                                { id: 'edit', label: 'עריכה', icon: 'edit', onClick: () => setForm({ purchase: p, supplierId: sup.id === NO_SUPPLIER ? '' : sup.id }) },
                                ...(doc?.state === 'sent' ? [{ id: 'more', label: 'החלפת חשבונית', icon: 'upload', onClick: () => inv.pick(invItem(g, p)) }] : []),
                                { id: 'del', label: 'מחיקה', icon: 'trash', danger: true, onClick: () => onDeleteExpense(p.id) }
                              ]}
                            />
                          </span>
                        </li>
                      )
                    })}
                    {sup.id !== NO_SUPPLIER && (
                      <li className="ice-buy-add">
                        <button type="button" className="link" onClick={() => setForm({ supplierId: sup.id })}>
                          <Icon name="plus" /> הוספת רכישה ל{sup.name}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {visible.length === 0 && (
          <Empty icon="card" title={s ? `אין ספק שמתאים ל״${q}״` : 'אין עדיין רכישות החודש'} text={s ? undefined : `${pl(empty.length, 'ספק קבוע ממתין', 'ספקים קבועים ממתינים')} ברשימה, כל אחד על ₪0.`}>
            <button className="btn btn--primary btn--sm" onClick={() => setForm({})}>
              <Icon name="plus" /> רכישה חדשה
            </button>
            {!s && empty.length > 0 && (
              <button className="btn btn--white btn--sm" onClick={() => setShow('all')}>
                הצגת כל הספקים
              </button>
            )}
          </Empty>
        )}
        {show === 'active' && !s && visible.length > 0 && empty.length > 0 && (
          <button type="button" className="link ice-sup-more" onClick={() => setShow('all')}>
            ועוד {pl(empty.length, 'ספק', 'ספקים')} בלי רכישות החודש (₪0) · הצגה
          </button>
        )}
        {inv.picker}
      </section>

      {form && (
        <Modal label="רכישה" onClose={() => setForm(null)}>
          {(close) => (
            <PurchaseForm
              initial={form.purchase}
              supplierId={form.supplierId}
              suppliers={suppliers}
              monthYear={monthYear}
              monthNumber={monthNumber}
              close={close}
              onSave={async (v, file) => {
                let supplier = suppliers.find((x) => x.id === v.supplierId)
                if (!supplier && v.newSupplier) supplier = await onSaveSupplier({ name: v.newSupplier.trim(), vat_exempt: v.exempt })
                if (!supplier) return false
                const vatAmount = v.exempt ? 0 : r2(v.total - v.total / (1 + VAT_RATE))
                const base = { supplier_id: supplier.id, name: supplier.name, description: v.description.trim() || null, amount: v.total, vat_amount: vatAmount, date: v.date, status: v.status }
                const saved = form.purchase
                  ? await onSaveExpense({ ...form.purchase, ...base })
                  : await onSaveExpense({ month_id: activeMonthId, notes: '', mood: supplier.mood || 'happy', ...base })
                if (!saved) return false
                notify?.(form.purchase ? 'הרכישה עודכנה' : `נוספה רכישה: ${supplier.name} · ${ils(v.total)}`, { tone: 'success' })
                setOpen((o) => ({ ...o, [supplier.id]: true }))
                if (file) inv.upload(file, { monthId: activeMonthId, kind: 'variable', id: saved.id, name: `${supplier.name} · ${fmt(v.date)}${base.description ? ` ${base.description}` : ''}` })
                return true
              }}
            />
          )}
        </Modal>
      )}

      {supForm && (
        <Modal label="ספק" onClose={() => setSupForm(null)}>
          {(close) => (
            <SupplierForm
              initial={supForm.id ? supForm : null}
              close={close}
              onSave={async (v) => {
                const saved = await onSaveSupplier(supForm.id ? { ...supForm, ...v } : v)
                if (saved) notify?.(supForm.id ? 'הספק עודכן' : `נוסף ספק: ${saved.name}`, { tone: 'success' })
                return !!saved
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

/* ============================================================== */
function PurchaseForm({ initial, supplierId, suppliers, monthYear, monthNumber, close, onSave }) {
  const now = new Date()
  const inMonth = monthYear === now.getFullYear() && monthNumber === now.getMonth() + 1
  const defDate = `${monthYear || now.getFullYear()}-${pad(monthNumber || now.getMonth() + 1)}-${pad(inMonth ? now.getDate() : 1)}`
  const sup0 = suppliers.find((s) => s.id === (initial?.supplier_id || supplierId))
  const [v, setV] = useState(() => ({
    supplierId: sup0?.id || (suppliers.length ? '' : 'new'),
    newSupplier: '',
    date: String(initial?.date || defDate).slice(0, 10),
    description: initial?.description || '',
    total: initial ? String(n0(initial.amount)) : '',
    exempt: initial ? initial.vat_amount === 0 : !!sup0?.vat_exempt,
    status: initial?.status || 'לא שולם'
  }))
  const [file, setFile] = useState(null)
  const [err, setErr] = useState({})
  const [busy, setBusy] = useState(false)
  const total = n0(v.total)
  const vat = v.exempt ? 0 : r2(total - total / (1 + VAT_RATE))
  const options = [...suppliers.filter((s) => s.active !== false).map((s) => ({ id: s.id, label: s.name })), { id: 'new', label: '+ ספק חדש' }]

  const submit = async () => {
    const e = {}
    if (v.supplierId === 'new' ? !v.newSupplier.trim() : !v.supplierId) e.supplier = 'צריך לבחור ספק'
    if (!(total > 0)) e.total = 'צריך סכום'
    if (!v.date) e.date = 'צריך תאריך'
    setErr(e)
    if (Object.keys(e).length || busy) return
    setBusy(true)
    const ok = await onSave({ ...v, total }, file)
    setBusy(false)
    if (ok) close()
  }

  return (
    <FormModal title={initial ? 'עריכת רכישה' : 'רכישה חדשה'} sub={initial ? `${initial.name}` : 'רכישה אחת = חשבונית אחת'} icon={initial ? 'edit' : 'card'} close={close} onSubmit={submit} submitLabel={busy ? 'שומר...' : initial ? 'שמירת שינויים' : 'הוספה'}>
      <Field label="ספק *" error={err.supplier} full>
        <Select
          value={v.supplierId}
          options={options}
          onChange={(id) => {
            const s = suppliers.find((x) => x.id === id)
            setV({ ...v, supplierId: id, exempt: s ? !!s.vat_exempt : v.exempt })
          }}
          placeholder="בחירת ספק"
        />
      </Field>
      {v.supplierId === 'new' && (
        <Field label="שם הספק החדש *" full>
          <input value={v.newSupplier} onChange={(e) => setV({ ...v, newSupplier: e.target.value })} placeholder="למשל: מרכז הדיו והסלולר" autoFocus />
        </Field>
      )}
      <Field label="תאריך *" error={err.date}>
        <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
      </Field>
      <Field label="סכום כולל מע״מ (₪) *" error={err.total}>
        <input inputMode="decimal" value={v.total} onChange={(e) => setV({ ...v, total: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" autoFocus={!!sup0} />
      </Field>
      <Field label="מה נקנה" hint="לא חובה" full>
        <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="למשל: טונר למדפסת" />
      </Field>
      <Field label="מע״מ">
        <Chips
          value={v.exempt ? 'no' : 'yes'}
          onChange={(x) => setV({ ...v, exempt: x === 'no' })}
          options={[
            { id: 'yes', label: `כולל ${Math.round(VAT_RATE * 100)}%` },
            { id: 'no', label: 'בלי מע״מ' }
          ]}
        />
      </Field>
      <Field label="תשלום">
        <Chips
          value={v.status}
          onChange={(x) => setV({ ...v, status: x })}
          options={[
            { id: 'לא שולם', label: 'לא שולם' },
            { id: 'שולם', label: 'שולם' }
          ]}
        />
      </Field>
      <div className="ice-vat-box is-full">
        <span>
          לפני מע״מ <b>{ils(total - vat, 2)}</b>
        </span>
        <span>
          מע״מ <b>{ils(vat, 2)}</b>
        </span>
        <span>
          סה״כ <b>{ils(total, 2)}</b>
        </span>
      </div>
      {!initial && (
        <Field label="חשבונית" hint="לא חובה · נשלחת למורנינג ומשויכת לרכישה" full>
          <label className="ice-file-pick">
            <Icon name="upload" />
            <span>{file ? file.name : 'בחירת קובץ או צילום'}</span>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
      )}
    </FormModal>
  )
}

function SupplierForm({ initial, close, onSave }) {
  const [v, setV] = useState(() => ({ name: initial?.name || '', vat_exempt: !!initial?.vat_exempt }))
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!v.name.trim()) return setErr('צריך שם')
    const ok = await onSave({ name: v.name.trim(), vat_exempt: v.vat_exempt })
    if (ok) close()
    return undefined
  }
  return (
    <FormModal title={initial ? 'עריכת ספק' : 'ספק חדש'} sub="הספק יופיע בכל חודש, על ₪0 עד שתוסיף לו רכישה" icon={initial ? 'edit' : 'userPlus'} close={close} onSubmit={submit} submitLabel={initial ? 'שמירה' : 'הוספה'}>
      <Field label="שם הספק *" error={err} full>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="למשל: מרכז הדיו והסלולר" autoFocus />
      </Field>
      <Field label="מע״מ" full>
        <Chips
          value={v.vat_exempt ? 'no' : 'yes'}
          onChange={(x) => setV({ ...v, vat_exempt: x === 'no' })}
          options={[
            { id: 'yes', label: 'עוסק מורשה (עם מע״מ)' },
            { id: 'no', label: 'פטור (בלי מע״מ)' }
          ]}
        />
      </Field>
    </FormModal>
  )
}
