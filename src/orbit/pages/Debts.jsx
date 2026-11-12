/* חובות והלוואות — the template's Loan files page: a folder per loan + a side column of stats. */
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { CardHead, Chips, DonutMulti, Drawer, Empty, Field, FormModal, HBars, MoodPill, MOODS, PageHead, Pill, Ring, SearchInput, Segmented, Select, StatusPill, nextMood, nextStatus, STATUS_TONE } from '../kit'
import { ils, ilsK } from '../lib'
import { Modal, MonthBar, downloadCsv } from './common'

const UNSET = 'לא סומן'
const statusOf = (d) => d.status || 'לא שולם'
const dayNum = (s) => {
  if (!s || s === UNSET) return null
  const parts = String(s).split('-')
  const n = parseInt(parts.length === 3 ? parts[2] : s, 10)
  return isNaN(n) ? null : n
}
/** Payments still left AFTER this month's one */
const paymentsLeft = (d) => {
  const pay = Number(d.monthly_payment) || 0
  const bal = Number(d.current_balance) || 0
  return pay > 0 ? Math.max(0, Math.ceil(bal / pay) - 1) : null
}
const leftLabel = (n) => (n === null ? '' : n === 0 ? 'התשלום האחרון החודש' : n === 1 ? 'נותר תשלום 1' : `נותרו ${n} תשלומים`)
const payoff = (n, y, m) => (n === null || !y || !m ? '' : new Date(y, m - 1 + n, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }))
const SORTS = [
  { id: 'balance', label: 'לפי יתרה' },
  { id: 'payment', label: 'לפי החזר חודשי' },
  { id: 'left', label: 'הכי קרוב לסגירה' }
]
const STATUS_OPTS = [
  { id: 'לא שולם', label: 'לא שולם' },
  { id: 'שולם חלקית', label: 'שולם חלקית' },
  { id: 'שולם', label: 'שולם' }
]
const MOOD_OPTS = Object.entries(MOODS).map(([id, m]) => ({ id, label: `${m.emoji} ${m.label}` }))
const BADGE = { 'לא שולם': 'pending', 'שולם חלקית': 'review', 'שולם': 'closed' }

function DebtFolder({ d, monthYear, monthNumber, ...rest }) {
  const bal = Number(d.current_balance) || 0
  const orig = Number(d.original_amount) || 0
  const pct = orig > 0 ? Math.max(0, Math.min(100, ((orig - bal) / orig) * 100)) : 0
  const n = paymentsLeft(d)
  const day = dayNum(d.payment_date)
  const st = statusOf(d)
  return (
    <div className={`file ${st === 'שולם' ? '' : 'file--cream'}`} {...rest}>
      <span className="file-tab" aria-hidden="true" />
      <div className="file-body">
        <div className="file-meta">
          <span>{day === null ? 'יום חיוב לא ידוע' : `חיוב ב־${day} לחודש`}</span>
          <span className="file-access">
            <Icon name="lock" />
            {n === null ? '—' : n === 0 ? 'אחרון' : `${n} תשלומים`}
          </span>
        </div>
        <h4>{d.name}</h4>
        <p className="file-lender">
          החזר {ils(d.monthly_payment)} · יתרה {ils(bal)}
        </p>
        <span className={`badge badge--${BADGE[st]}`}>{st === 'שולם' ? 'שולם החודש' : st}</span>
        <div className="file-foot">
          <span className="bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span>{n ? `עד ${payoff(n, monthYear, monthNumber)}` : `${Math.round(pct)}% סולק`}</span>
        </div>
      </div>
    </div>
  )
}

export default function Debts(props) {
  const { debts = [], activeMonthId, monthYear, monthNumber, months = [], onChangeMonth, onAddMonth, onSaveDebt, onDeleteDebt, notify } = props
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('balance')
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState(null)

  const save = (d, patch) => onSaveDebt({ ...d, ...patch })
  const markPaid = (d) => {
    const prev = statusOf(d)
    save(d, { status: 'שולם' })
    notify?.(`סומן כשולם: ${d.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => save(d, { status: prev }) } })
  }

  const count = (s) => debts.filter((d) => statusOf(d) === s).length
  const query = q.trim().toLowerCase()
  const shown = useMemo(() => {
    const list = debts.filter((d) => (status === 'all' || statusOf(d) === status) && (!query || d.name.toLowerCase().includes(query)))
    const by = {
      balance: (a, b) => (Number(b.current_balance) || 0) - (Number(a.current_balance) || 0),
      payment: (a, b) => (Number(b.monthly_payment) || 0) - (Number(a.monthly_payment) || 0),
      left: (a, b) => (paymentsLeft(a) ?? 9999) - (paymentsLeft(b) ?? 9999)
    }
    return [...list].sort(by[sort])
  }, [debts, status, query, sort])

  const balance = debts.reduce((a, d) => a + (Number(d.current_balance) || 0), 0)
  const original = debts.reduce((a, d) => a + (Number(d.original_amount) || 0), 0)
  const monthly = debts.reduce((a, d) => a + (Number(d.monthly_payment) || 0), 0)
  const repaidPct = original > 0 ? Math.max(0, ((original - balance) / original) * 100) : 0
  const leftThisMonth = debts.filter((d) => statusOf(d) !== 'שולם').reduce((a, d) => a + (Number(d.monthly_payment) || 0), 0)
  const byStatus = [
    { label: 'לא שולם', value: debts.filter((d) => statusOf(d) === 'לא שולם').reduce((a, d) => a + (Number(d.monthly_payment) || 0), 0), color: '#ee5d55' },
    { label: 'שולם חלקית', value: debts.filter((d) => statusOf(d) === 'שולם חלקית').reduce((a, d) => a + (Number(d.monthly_payment) || 0), 0), color: '#f0a43c' },
    { label: 'שולם', value: debts.filter((d) => statusOf(d) === 'שולם').reduce((a, d) => a + (Number(d.monthly_payment) || 0), 0), color: '#6cc06a' }
  ]
  const byLender = [...debts]
    .map((d) => ({ label: d.name, value: Number(d.current_balance) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
  const open = debts.find((d) => d.id === openId)

  const exportCsv = () => {
    downloadCsv('חובות.csv', [['שם', 'החזר חודשי', 'יתרה', 'יום חיוב', 'סטטוס', 'תשלומים שנותרו'], ...debts.map((d) => [d.name, d.monthly_payment, d.current_balance, dayNum(d.payment_date) ?? 'לא ידוע', statusOf(d), paymentsLeft(d) ?? ''])])
    notify?.('החובות יוצאו לקובץ', { tone: 'success' })
  }

  return (
    <div className="page">
      <PageHead
        title="חובות והלוואות"
        sub={
          <>
            <b>{debts.length}</b> חובות פעילים · יתרה כוללת <b>{ils(balance)}</b> · החזר חודשי <b>{ils(monthly)}</b>
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--white" onClick={exportCsv}>
          <Icon name="download" /> ייצוא
        </button>
        <button className="btn btn--primary" onClick={() => setForm({})}>
          <Icon name="plus" /> חוב חדש
        </button>
      </PageHead>

      <div className="split split--wide lf-layout">
        <div className="stack">
          <div className="toolbar rv" style={{ '--i': 3 }}>
            <Segmented
              label="סטטוס"
              value={status}
              onChange={setStatus}
              options={[
                { id: 'all', label: 'הכל', count: debts.length },
                { id: 'לא שולם', label: 'לא שולם', count: count('לא שולם') },
                { id: 'שולם חלקית', label: 'חלקית', count: count('שולם חלקית') },
                { id: 'שולם', label: 'שולם', count: count('שולם') }
              ]}
            />
            <span className="toolbar-spacer" />
            <SearchInput value={q} onChange={setQ} placeholder="חיפוש חוב או מלווה" />
            <Select label="מיון" icon="sort" value={sort} options={SORTS} onChange={setSort} align="end" />
          </div>

          {shown.length ? (
            <div className="lf-grid">
              {shown.map((d, i) => (
                <div key={d.id} className="lf-cell card-in" style={{ '--d': Math.min(i, 8) + 1 }}>
                  <DebtFolder
                    d={d}
                    monthYear={monthYear}
                    monthNumber={monthNumber}
                    role="button"
                    tabIndex={0}
                    aria-label={`${d.name}, ${statusOf(d)}. פתיחת פרטים`}
                    onClick={() => setOpenId(d.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenId(d.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="card card-in">
              <Empty icon="bank" title={debts.length ? 'אין חוב שמתאים' : 'אין חובות פעילים בחודש הזה'} text={debts.length ? 'נסה סטטוס או חיפוש אחר.' : 'הלוואות, ליסינג ומימון — כל מה שמחזירים בתשלומים.'}>
                {debts.length ? (
                  <button className="btn btn--ghost btn--sm" onClick={() => { setStatus('all'); setQ('') }}>ניקוי סינון</button>
                ) : (
                  <button className="btn btn--primary btn--sm" onClick={() => setForm({})}><Icon name="plus" /> חוב חדש</button>
                )}
              </Empty>
            </div>
          )}
        </div>

        <aside className="stack">
          <section className="card card-pad card-in lf-docs" style={{ '--d': 2 }}>
            <CardHead title="כמה כבר סילקנו" sub="מתוך הקרן המקורית של כל החובות" icon="bank" />
            <div className="lf-docs-body">
              <Ring value={repaidPct} size="7.5rem" stroke={11} d={2} label={`${Math.round(repaidPct)}% סולק`}>
                <b>{Math.round(repaidPct)}%</b>
                <span>סולק</span>
              </Ring>
              <ul>
                <li className="rv" style={{ '--i': 0 }}>
                  <b>{ilsK(Math.max(0, original - balance))}</b>
                  <span>סולק</span>
                </li>
                <li className="rv" style={{ '--i': 1 }}>
                  <b>{ilsK(balance)}</b>
                  <span>יתרה</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="card card-pad card-in" style={{ '--d': 3 }}>
            <CardHead title="ההחזר של החודש" sub={`נותר לשלם ${ils(leftThisMonth)}`} icon="pie" />
            <DonutMulti items={byStatus} size="8.5rem" thickness={14} d={3} format={(v) => ilsK(v)} title="החזר חודשי" />
          </section>

          <section className="card card-pad card-in" style={{ '--d': 4 }}>
            <CardHead title="יתרה לפי מלווה" sub="הגדולים קודם" icon="building" />
            <HBars items={byLender} d={4} format={(v) => ilsK(v)} color="var(--teal-2)" />
          </section>
        </aside>
      </div>

      {open && (
        <Drawer label={open.name} onClose={() => setOpenId(null)}>
          {(close) => {
            const n = paymentsLeft(open)
            const day = dayNum(open.payment_date)
            const st = statusOf(open)
            return (
              <div className="cus-drawer">
                <header className="cus-dh">
                  <span className="avatar avatar--initials cus-dh-avatar ice-av-bank"><Icon name="bank" /></span>
                  <div className="cus-dh-text">
                    <h3>{open.name}</h3>
                    <p><Icon name="calendar" /> {day === null ? 'יום חיוב לא ידוע' : `חיוב ב־${day} לחודש`}</p>
                    <Pill tone={STATUS_TONE[st]}>{st}</Pill>
                  </div>
                  <button className="icon-btn" onClick={close} aria-label="סגירה"><Icon name="x" /></button>
                </header>
                <div className="cus-quick">
                  {st !== 'שולם' && <button className="btn btn--primary btn--sm" onClick={() => markPaid(open)}><Icon name="check" /> סמן כשולם החודש</button>}
                  <button className="btn btn--ghost btn--sm" onClick={() => setForm(open)}><Icon name="edit" /> עריכה</button>
                </div>
                <div className="cus-facts">
                  <div><span>החזר חודשי</span><b>{ils(open.monthly_payment)}</b></div>
                  <div><span>יתרה נוכחית</span><b>{ils(open.current_balance)}</b></div>
                  <div><span>קרן מקורית</span><b>{ils(open.original_amount)}</b></div>
                  <div><span>תשלומים שנותרו</span><b>{n === null ? '—' : n}</b></div>
                  <div><span>ייסגר ב</span><b>{n ? payoff(n, monthYear, monthNumber) : n === 0 ? 'החודש' : '—'}</b></div>
                  <div><span>המלווה</span><b>{MOODS[open.mood || 'happy']?.emoji} {MOODS[open.mood || 'happy']?.label}</b></div>
                </div>
                <div className="cus-row">
                  <span className="cus-label">סטטוס החודש</span>
                  <span className="ice-row-pills">
                    <StatusPill status={st} onClick={() => save(open, { status: nextStatus(st) })} />
                    <MoodPill mood={open.mood} onClick={() => save(open, { mood: nextMood(open.mood || 'happy') })} />
                  </span>
                </div>
                <p className="ob-hint">{leftLabel(n)}. בחודש חדש היתרה יורדת אוטומטית בגובה ההחזר.</p>
                <button className="cus-delete" onClick={() => { close(); setOpenId(null); onDeleteDebt(open.id) }}>
                  <Icon name="trash" /> מחיקת החוב
                </button>
              </div>
            )
          }}
        </Drawer>
      )}

      {form && (
        <Modal label="טופס חוב" onClose={() => setForm(null)}>
          {(close) => (
            <DebtForm
              initial={form.id ? form : null}
              close={close}
              monthYear={monthYear}
              monthNumber={monthNumber}
              onSave={async (v) => {
                const base = { name: v.name, monthly_payment: v.payment, current_balance: v.balance, payment_date: v.day ? String(v.day) : UNSET, status: v.status, mood: v.mood }
                if (form.id) await onSaveDebt({ ...form, ...base })
                else await onSaveDebt({ month_id: activeMonthId, original_amount: v.balance, ...base })
                notify?.(form.id ? `נשמר: ${v.name}` : `נוסף חוב: ${v.name}`, { tone: 'success' })
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function DebtForm({ initial, close, onSave, monthYear, monthNumber }) {
  const n0 = initial ? dayNum(initial.payment_date) : 10
  const [v, setV] = useState(() => ({
    name: initial?.name || '',
    payment: initial ? String(initial.monthly_payment ?? '') : '',
    balance: initial ? String(initial.current_balance ?? '') : '',
    day: n0 === null ? '' : String(n0),
    status: initial ? statusOf(initial) : 'לא שולם',
    mood: initial?.mood || 'happy'
  }))
  const [errors, setErrors] = useState({})
  const p = Number(v.payment) || 0
  const left = p > 0 ? Math.max(0, Math.ceil((Number(v.balance) || 0) / p) - 1) : null
  const submit = () => {
    const err = {}
    if (!v.name.trim()) err.name = 'צריך שם'
    if (v.payment === '' || !(Number(v.payment) >= 0)) err.payment = 'צריך החזר חודשי'
    if (v.balance === '' || !(Number(v.balance) >= 0)) err.balance = 'צריך יתרה'
    if (v.day !== '' && !(Number(v.day) >= 1 && Number(v.day) <= 31)) err.day = 'יום בין 1 ל־31'
    setErrors(err)
    if (Object.keys(err).length) return
    onSave({ ...v, name: v.name.trim(), payment: Number(v.payment) || 0, balance: Number(v.balance) || 0 })
    close()
  }
  return (
    <FormModal title={initial ? 'עריכת חוב' : 'חוב חדש'} sub={initial ? initial.name : 'הלוואה, ליסינג או מימון'} icon={initial ? 'edit' : 'bank'} close={close} onSubmit={submit} submitLabel={initial ? 'שמירת שינויים' : 'הוספה'}>
      <Field label="גורם מלווה / ספק *" error={errors.name} full>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="לדוגמה: הלוואה בנק לאומי" autoFocus />
      </Field>
      <Field label="החזר חודשי (₪) *" error={errors.payment}>
        <input inputMode="decimal" value={v.payment} onChange={(e) => setV({ ...v, payment: e.target.value })} placeholder="0" />
      </Field>
      <Field label="יתרת חוב נוכחית (₪) *" error={errors.balance}>
        <input inputMode="decimal" value={v.balance} onChange={(e) => setV({ ...v, balance: e.target.value })} placeholder="0" />
      </Field>
      {left !== null && (
        <p className="ice-form-note">
          {leftLabel(left)}
          {left > 0 && monthYear ? ` · ייסגר ב${payoff(left, monthYear, monthNumber)}` : ''}
        </p>
      )}
      <Field label="יום חיוב בחודש" error={errors.day} hint="השאר ריק אם לא ידוע">
        <input inputMode="numeric" value={v.day} onChange={(e) => setV({ ...v, day: e.target.value.replace(/\D/g, '') })} placeholder="לא ידוע" />
      </Field>
      <Field label="סטטוס התשלום החודש">
        <Select value={v.status} options={STATUS_OPTS} onChange={(x) => setV({ ...v, status: x })} />
      </Field>
      <Field label="כמה המלווה לחוץ" full>
        <Chips options={MOOD_OPTS} value={v.mood} onChange={(x) => setV({ ...v, mood: x })} />
      </Field>
    </FormModal>
  )
}
