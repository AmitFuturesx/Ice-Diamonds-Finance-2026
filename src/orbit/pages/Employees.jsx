/* עובדים ושכר — payroll per department; monthly numbers are typed straight into the table. */
import { useState } from 'react'
import Icon from '../Icon'
import { Avatar, CardHead, Chips, DonutMulti, Empty, Field, FormModal, HBars, Kpi, Menu, PageHead, Segmented, Select, StatusPill, nextStatus } from '../kit'
import { ils, ilsK } from '../lib'
import { computePay, VAT_RATE } from '../../lib/payroll'
import { Modal, MonthBar } from './common'

const DEPTS = [
  { id: 'sales', label: 'אנשי מכירות', noun: 'נציג', hint: 'לדוג׳ נציג מכירות' },
  { id: 'freelancer', label: 'פרילנסרים', noun: 'פרילנסר', hint: 'לדוג׳ שיווק לעסק' },
  { id: 'staff', label: 'עובדים נוספים', noun: 'עובד', hint: 'לדוג׳ אחראית חנות' }
]
const VAT_LABEL = { plus_vat: 'עוסק מורשה (+מע״מ)', exempt: 'עוסק פטור', none: 'שכיר (ללא מע״מ)' }
const DEFAULT_VAT = { freelancer: 'plus_vat', sales: 'none', staff: 'none' }
const empty = (department) => ({ name: '', department, role: '', hourly_rate: 0, monthly_fee: 0, commission_pct: 0, manager_id: null, override_pct: 0, vat_mode: DEFAULT_VAT[department], active: true })

export default function Employees(props) {
  const { employees = [], employeeMonths = [], activeMonthId, months = [], onChangeMonth, onAddMonth, onSaveEmployee, onDeleteEmployee, onSaveEmployeeMonth, notify } = props
  const [dept, setDept] = useState('sales')
  const [form, setForm] = useState(null)

  const byEmp = {}
  employeeMonths.forEach((m) => (byEmp[m.employee_id] = m))
  const rows = employees.map((e) => ({ emp: e, month: byEmp[e.id], pay: computePay(e, byEmp[e.id], employees, byEmp), status: byEmp[e.id]?.status || 'לא שולם' }))
  const owed = rows.reduce((a, r) => a + r.pay.total, 0)
  const paid = rows.filter((r) => r.status === 'שולם').reduce((a, r) => a + r.pay.total, 0)
  const vat = rows.reduce((a, r) => a + r.pay.vat, 0)
  const deptRows = rows.filter((r) => r.emp.department === dept)
  const isFree = dept === 'freelancer'
  const D = DEPTS.find((d) => d.id === dept)

  const saveMonth = (emp, patch) => {
    const m = byEmp[emp.id]
    return onSaveEmployeeMonth({ employee_id: emp.id, month_id: activeMonthId, hours: m?.hours || 0, deals_count: m?.deals_count || 0, deals_amount: m?.deals_amount || 0, status: m?.status || 'לא שולם', notes: m?.notes || '', ...patch })
  }
  const cycle = (r) => {
    const prev = r.status
    const next = nextStatus(prev)
    saveMonth(r.emp, { status: next })
    if (next === 'שולם') notify?.(`סומן כשולם: ${r.emp.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => saveMonth(r.emp, { status: prev }) } })
  }
  const numIn = (emp, field, label) => {
    const current = Number(byEmp[emp.id]?.[field]) || 0
    return (
      <input
        key={`${emp.id}-${activeMonthId}-${field}-${current}`}
        className="ice-num-input"
        type="number"
        min="0"
        inputMode="decimal"
        aria-label={`${label} · ${emp.name}`}
        defaultValue={current || ''}
        placeholder="0"
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          const v = Number(e.target.value) || 0
          if (v !== current) saveMonth(emp, { [field]: v })
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    )
  }
  const breakdown = (r) => {
    const parts = []
    if (r.pay.fixedPay > 0) parts.push(`קבוע ${ils(r.pay.fixedPay)}`)
    if (r.emp.hourly_rate > 0) parts.push(`שעתי ${ils(r.pay.hourlyPay)}`)
    if (r.emp.commission_pct > 0) parts.push(`עמלה ${r.emp.commission_pct}% ${ils(r.pay.ownCommission)}`)
    if (r.emp.override_pct > 0) parts.push(`מהצוות ${r.emp.override_pct}% ${ils(r.pay.overridePay)}`)
    return parts.join(' · ') || '—'
  }
  const menuFor = (r) => [
    { id: 'edit', label: 'עריכת הגדרות', icon: 'edit', onClick: () => setForm({ ...r.emp }) },
    ...(r.status !== 'שולם' ? [{ id: 'paid', label: 'סמן כשולם', icon: 'check', onClick: () => { saveMonth(r.emp, { status: 'שולם' }); notify?.(`סומן כשולם: ${r.emp.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => saveMonth(r.emp, { status: r.status }) } }) } }] : []),
    { id: 'del', label: 'מחיקה', icon: 'trash', danger: true, onClick: () => onDeleteEmployee(r.emp.id) }
  ]
  const cols = isFree ? 'minmax(11rem, 1.5fr) minmax(12rem, 2fr) 8rem 8.5rem 2rem' : 'minmax(11rem, 1.5fr) 5.5rem 5rem 7rem minmax(10rem, 1.6fr) 7.5rem 7.5rem 2rem'

  return (
    <div className="page">
      <PageHead
        title="עובדים ושכר"
        sub={
          <>
            <b>{employees.length}</b> אנשי צוות · שכר החודש <b>{ils(owed)}</b>
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--primary" onClick={() => setForm(empty(dept))}>
          <Icon name="userPlus" /> הוספת {D.noun}
        </button>
      </PageHead>

      <div className="grid-kpi">
        <Kpi icon="users" label="סה״כ שכר החודש" value={owed} d={0} foot={`${employees.length} אנשים`} />
        <Kpi icon="clock" label="נותר לשלם" value={owed - paid} tone="red" d={1} foot={`${rows.filter((r) => r.status !== 'שולם').length} עדיין לא קיבלו`} />
        <Kpi icon="check" label="כבר שולם" value={paid} tone="teal" d={2} foot={owed ? `${Math.round((paid / owed) * 100)}% מהשכר` : null} />
        <Kpi icon="receipt" label={`מתוכו מע״מ (${Math.round(VAT_RATE * 100)}%)`} value={vat} tone="orange" d={3} />
      </div>

      <section className="card card-pad card-in has-mlist" style={{ '--d': 4 }}>
        <div className="toolbar rv" style={{ '--i': 0 }}>
          <Segmented
            label="מחלקה"
            value={dept}
            onChange={setDept}
            options={DEPTS.map((d) => ({ id: d.id, label: d.label, count: employees.filter((e) => e.department === d.id).length }))}
          />
          <span className="toolbar-spacer" />
          <span className="ice-dept-total">
            סה״כ {D.label}: <b>{ils(deptRows.reduce((a, r) => a + r.pay.total, 0))}</b>
          </span>
        </div>

        <div className="tbl-wrap rv" style={{ '--i': 1 }}>
          <div className="tbl" style={{ '--cols': cols, '--min': isFree ? '46rem' : '66rem' }}>
            <div className="tbl-row tbl-head">
              <span>שם</span>
              {!isFree && <span>שעות</span>}
              {!isFree && <span>עסקאות</span>}
              {!isFree && <span>₪ לעסקה</span>}
              <span>פירוט</span>
              <span>לתשלום</span>
              <span>סטטוס</span>
              <span />
            </div>
            <div className="tbl-body">
              {deptRows.map((r, i) => {
                const mgr = employees.find((x) => x.id === r.emp.manager_id)
                return (
                  <div key={r.emp.id} className="tbl-row rv ice-row-static" style={{ '--i': i + 2 }}>
                    <span className="person">
                      <Avatar name={r.emp.name} />
                      <span className="person-text">
                        <b>{r.emp.name}</b>
                        <span>
                          {r.emp.role || '—'}
                          {mgr ? ` · תחת ${mgr.name}` : ''}
                        </span>
                      </span>
                    </span>
                    {!isFree && <span>{numIn(r.emp, 'hours', 'שעות')}</span>}
                    {!isFree && <span>{numIn(r.emp, 'deals_count', 'עסקאות')}</span>}
                    {!isFree && <span>{numIn(r.emp, 'deals_amount', 'סכום לעסקה')}</span>}
                    <span className="tbl-muted ice-breakdown">
                      {breakdown(r)}
                      <small>
                        {VAT_LABEL[r.emp.vat_mode]}
                        {r.pay.vat > 0 ? ` · +${ils(r.pay.vat)}` : ''}
                      </small>
                    </span>
                    <span className="tbl-num">{ils(r.pay.total)}</span>
                    <span>
                      <StatusPill status={r.status} onClick={() => cycle(r)} />
                    </span>
                    <span className="tbl-end">
                      <Menu items={menuFor(r)} />
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <ul className="mlist">
          {deptRows.map((r) => (
            <li key={r.emp.id} className="ice-row-static">
              <div className="mlist-top">
                <Avatar name={r.emp.name} />
                <div className="mlist-main">
                  <b>{r.emp.name}</b>
                  <span>{breakdown(r)}</span>
                </div>
                <b className="mlist-amt">{ils(r.pay.total)}</b>
                <Menu items={menuFor(r)} />
              </div>
              {!isFree && (
                <div className="ice-mnums">
                  <label>שעות {numIn(r.emp, 'hours', 'שעות')}</label>
                  <label>עסקאות {numIn(r.emp, 'deals_count', 'עסקאות')}</label>
                  <label>₪ לעסקה {numIn(r.emp, 'deals_amount', 'סכום לעסקה')}</label>
                </div>
              )}
              <div className="mlist-pills">
                <StatusPill status={r.status} onClick={() => cycle(r)} />
              </div>
            </li>
          ))}
        </ul>

        {deptRows.length === 0 && (
          <Empty icon="users" title={`עוד אין ${D.label}`} text="מוסיפים איש צוות, וכל חודש ממלאים לו שעות ועסקאות.">
            <button className="btn btn--primary btn--sm" onClick={() => setForm(empty(dept))}>
              <Icon name="userPlus" /> הוספת {D.noun}
            </button>
          </Empty>
        )}
        {!isFree && deptRows.length > 0 && (
          <p className="ob-hint ice-hint-top">
            ממלאים שעות, כמות עסקאות וסכום לכל עסקה — זה נשמר לבד כשיוצאים מהשדה. עמלה = עסקאות × סכום לעסקה × אחוז העמלה.
          </p>
        )}
      </section>

      <div className="split split--even">
        <section className="card card-pad card-in" style={{ '--d': 5 }}>
          <CardHead title="שכר לפי מחלקה" sub="החודש הפתוח" icon="users" />
          <HBars items={DEPTS.map((d) => ({ label: d.label, value: rows.filter((r) => r.emp.department === d.id).reduce((a, r) => a + r.pay.total, 0) }))} d={5} format={(v) => ilsK(v)} color="var(--teal-2)" />
        </section>
        <section className="card card-pad card-in" style={{ '--d': 6 }}>
          <CardHead title="מצב התשלומים" sub="כמה כבר יצא לעובדים" icon="pie" />
          {owed > 0 ? (
            <DonutMulti
              items={[
                { label: 'שולם', value: paid, color: '#6cc06a' },
                { label: 'נותר', value: owed - paid, color: '#ee5d55' }
              ]}
              size="9rem"
              thickness={14}
              d={6}
              format={(v) => ilsK(v)}
              title="שכר"
            />
          ) : (
            <p className="empty">אין עדיין שכר החודש</p>
          )}
        </section>
      </div>

      {form && (
        <Modal label="טופס עובד" onClose={() => setForm(null)}>
          {(close) => (
            <EmployeeForm
              initial={form}
              employees={employees}
              close={close}
              onSave={async (v) => {
                await onSaveEmployee({ ...v, manager_id: v.department === 'sales' ? v.manager_id : null })
                notify?.(v.id ? `נשמר: ${v.name}` : `נוסף: ${v.name}`, { tone: 'success' })
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function EmployeeForm({ initial, employees, close, onSave }) {
  const [v, setV] = useState(() => ({ ...initial }))
  const [err, setErr] = useState({})
  const num = (k) => ({ value: v[k] || '', onChange: (e) => setV({ ...v, [k]: Number(e.target.value) || 0 }), inputMode: 'decimal', placeholder: '0' })
  const managers = employees.filter((e) => e.department === 'sales' && e.id !== v.id)
  const submit = () => {
    const e = {}
    if (!String(v.name || '').trim()) e.name = 'צריך שם'
    setErr(e)
    if (Object.keys(e).length) return
    onSave({ ...v, name: v.name.trim() })
    close()
  }
  return (
    <FormModal title={v.id ? `עריכת ${initial.name}` : 'הוספת איש צוות'} sub="ההגדרות קבועות; השעות והעסקאות מתמלאות כל חודש בטבלה" icon={v.id ? 'edit' : 'userPlus'} close={close} onSubmit={submit} submitLabel={v.id ? 'שמירת שינויים' : 'הוספה'}>
      <Field label="שם *" error={err.name}>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
      </Field>
      <Field label="תפקיד">
        <input value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} placeholder={DEPTS.find((d) => d.id === v.department)?.hint} />
      </Field>
      <Field label="מחלקה" full>
        <Chips options={DEPTS.map((d) => ({ id: d.id, label: d.label }))} value={v.department} onChange={(d) => setV({ ...v, department: d, vat_mode: v.id ? v.vat_mode : DEFAULT_VAT[d] })} />
      </Field>
      <Field label="מע״מ" full>
        <Chips options={Object.entries(VAT_LABEL).map(([id, label]) => ({ id, label }))} value={v.vat_mode} onChange={(m) => setV({ ...v, vat_mode: m })} />
      </Field>
      <Field label="תשלום חודשי קבוע (₪)">
        <input {...num('monthly_fee')} />
      </Field>
      <Field label="שכר שעתי (₪)">
        <input {...num('hourly_rate')} />
      </Field>
      {v.department !== 'freelancer' && (
        <Field label="עמלה על כל עסקה (%)">
          <input {...num('commission_pct')} />
        </Field>
      )}
      {v.department === 'sales' && (
        <>
          <Field label="מנהל הצוות שלו">
            <Select value={v.manager_id || ''} options={[{ id: '', label: 'ללא מנהל' }, ...managers.map((m) => ({ id: m.id, label: m.name }))]} onChange={(id) => setV({ ...v, manager_id: id || null })} />
          </Field>
          <Field label="אחוז מהנציגים שתחתיו (%)" hint="דוגמה: מנהל עם 3% מקבל 3% מכל עסקה של הנציגים שתחתיו, בנוסף לעמלה שלו" full>
            <input {...num('override_pct')} />
          </Field>
        </>
      )}
    </FormModal>
  )
}
