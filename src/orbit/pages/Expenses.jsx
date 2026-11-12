/* הוצאות קבועות / משתנות — the template's Customers page, fed with this month's expenses. */
import { useMemo, useState } from 'react'
import Icon from '../Icon'
import { Avatar, CardHead, Check, Chips, Drawer, Empty, Field, FormModal, Highlight, Kpi, Menu, MoodPill, MOODS, PageHead, Pager, Pill, SearchInput, Segmented, Select, StatusPill, nextMood, nextStatus, STATUS_TONE } from '../kit'
import { ils, pctChange } from '../lib'
import { DAY_KEYS, DAY_LABEL, DayPill, Modal, MonthBar, SortBtn, downloadCsv, nextDay, seriesOf, snapDay, useHistory, useSorted } from './common'

const PER = 10
const TEXT = {
  fixed: { title: 'הוצאות קבועות', noun: 'הוצאה קבועה', icon: 'receipt', field: 'fixed', ph: 'לדוגמה: שכירות חנות', empty: 'שכירות, ארנונה, תקשורת, ביטוחים — כל מה שחוזר כל חודש.' },
  variable: { title: 'הוצאות משתנות', noun: 'הוצאה משתנה', icon: 'card', field: 'variable', ph: 'לדוגמה: חומרי גלם', empty: 'רכש, פרסום, תיקונים — כל מה שמשתנה מחודש לחודש.' }
}
const STATUS_OPTS = [
  { id: 'לא שולם', label: 'לא שולם' },
  { id: 'שולם חלקית', label: 'שולם חלקית' },
  { id: 'שולם', label: 'שולם' }
]
const MOOD_OPTS = Object.entries(MOODS).map(([id, m]) => ({ id, label: `${m.emoji} ${m.label}` }))
const DAY_OPTS = DAY_KEYS.map((d) => ({ id: d, label: DAY_LABEL[d] }))
const TONE_COLOR = { green: 'var(--green)', orange: 'var(--orange)', red: 'var(--red)' }
const STATUS_RANK = { 'לא שולם': 0, 'שולם חלקית': 1, 'שולם': 2 }
const pad = (n) => String(n).padStart(2, '0')

export default function Expenses(props) {
  const { kind, expenses = [], activeMonthId, monthYear, monthNumber, months = [], onChangeMonth, onAddMonth, onSaveExpense, onDeleteExpense, notify } = props
  const T = TEXT[kind]

  /* billing day — fixed keeps "10"/"" in payment_date, variable keeps a full date */
  const dayOf = (e) => (kind === 'fixed' ? snapDay(e.payment_date ? parseInt(e.payment_date, 10) : NaN) : snapDay(e.date ? parseInt(e.date.split('-')[2], 10) : NaN))
  const dayPatch = (d) => {
    if (kind === 'fixed') return { payment_date: d === 'unknown' ? '' : d }
    if (d === 'unknown') return { date: '' }
    return { date: `${monthYear || new Date().getFullYear()}-${pad(monthNumber || new Date().getMonth() + 1)}-${pad(Number(d))}` }
  }
  const save = (e, patch) => onSaveExpense({ ...e, ...patch })
  const amt = (e) => Number(e.amount) || 0

  /* totals + history */
  const total = expenses.reduce((a, e) => a + amt(e), 0)
  const sumBy = (s) => expenses.filter((e) => e.status === s).reduce((a, e) => a + amt(e), 0)
  const countBy = (s) => expenses.filter((e) => e.status === s).length
  const paid = sumBy('שולם')
  const partial = sumBy('שולם חלקית')
  const unpaid = sumBy('לא שולם')
  const { win, hist } = useHistory(months, activeMonthId)
  const spark = seriesOf(win, hist, activeMonthId, T.field, total)
  const prev = spark.length > 1 ? spark[spark.length - 2] : null

  /* filters */
  const [status, setStatus] = useState('all')
  const [day, setDay] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState([])
  const s = q.trim().toLowerCase()
  const filtered = useMemo(
    () => expenses.filter((e) => (status === 'all' || e.status === status) && (day === 'all' || dayOf(e) === day) && (!s || `${e.name} ${e.notes || ''}`.toLowerCase().includes(s))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, status, day, s]
  )
  const sorted = useSorted(filtered, sort, {
    name: (a, b) => a.name.localeCompare(b.name, 'he'),
    amount: (a, b) => amt(a) - amt(b),
    day: (a, b) => DAY_KEYS.indexOf(dayOf(a)) - DAY_KEYS.indexOf(dayOf(b)),
    status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || amt(b) - amt(a)
  })
  const pages = Math.max(1, Math.ceil(sorted.length / PER))
  const cur = Math.min(page, pages)
  const rows = sorted.slice((cur - 1) * PER, cur * PER)
  const pickedSet = new Set(picked)
  const allOnPage = rows.length > 0 && rows.every((r) => pickedSet.has(r.id))
  const someOnPage = rows.some((r) => pickedSet.has(r.id))
  const reset = (fn) => (v) => {
    fn(v)
    setPage(1)
  }

  /* actions */
  const markPaid = (list) => {
    const before = list.map((e) => ({ e, status: e.status }))
    list.forEach((e) => save(e, { status: 'שולם' }))
    setPicked([])
    notify?.(list.length === 1 ? `סומן כשולם: ${list[0].name}` : `${list.length} תשלומים סומנו כשולמו`, {
      tone: 'success',
      duration: 7000,
      action: { label: 'בטל', run: () => before.forEach(({ e, status: st }) => save(e, { status: st })) }
    })
  }
  const remove = (ids) => {
    ids.forEach((id) => onDeleteExpense(id))
    setPicked((p) => p.filter((id) => !ids.includes(id)))
    if (ids.includes(openId)) setOpenId(null)
  }
  const exportCsv = () => {
    downloadCsv(`${T.title}.csv`, [['שם', 'סכום', 'יום חיוב', 'סטטוס', 'ספק', 'הערות'], ...sorted.map((e) => [e.name, amt(e), DAY_LABEL[dayOf(e)], e.status, MOODS[e.mood || 'happy']?.label, e.notes || ''])])
    notify?.(`יוצאו ${sorted.length} שורות`, { tone: 'success' })
  }

  /* drawer + form */
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState(null)
  const open = expenses.find((e) => e.id === openId)

  const statusTabs = [
    { id: 'all', label: 'הכל', count: expenses.length },
    { id: 'לא שולם', label: 'לא שולם', count: countBy('לא שולם') },
    { id: 'שולם חלקית', label: 'חלקית', count: countBy('שולם חלקית') },
    { id: 'שולם', label: 'שולם', count: countBy('שולם') }
  ]
  const top = [...expenses].sort((a, b) => amt(b) - amt(a)).slice(0, 5)
  const byDay = DAY_KEYS.map((d) => {
    const items = expenses.filter((e) => dayOf(e) === d)
    const t = items.reduce((a, e) => a + amt(e), 0)
    const left = items.filter((e) => e.status !== 'שולם').reduce((a, e) => a + amt(e), 0)
    return { d, t, left, n: items.length }
  })

  const menuFor = (e) => [
    { id: 'view', label: 'פרטים', icon: 'eye', onClick: () => setOpenId(e.id) },
    { id: 'edit', label: 'עריכה', icon: 'edit', onClick: () => setForm(e) },
    ...(e.status !== 'שולם' ? [{ id: 'paid', label: 'סמן כשולם', icon: 'check', onClick: () => markPaid([e]) }] : []),
    { id: 'del', label: 'מחיקה', icon: 'trash', danger: true, onClick: () => remove([e.id]) }
  ]

  return (
    <div className="page">
      <PageHead
        title={T.title}
        sub={
          <>
            <b>{expenses.length}</b> תשלומים החודש · נותרו לשלם <b>{ils(unpaid + partial)}</b>
          </>
        }
      >
        <MonthBar months={months} value={activeMonthId} onChange={onChangeMonth} onAdd={onAddMonth} />
        <button className="btn btn--white" onClick={exportCsv}>
          <Icon name="download" /> ייצוא
        </button>
        <button className="btn btn--primary" onClick={() => setForm({})}>
          <Icon name="plus" /> {T.noun} חדשה
        </button>
      </PageHead>

      <div className="grid-kpi">
        <Kpi icon={T.icon} label="סה״כ החודש" value={total} spark={spark} delta={prev ? pctChange(total, prev) : null} goodWhenUp={false} d={0} active={status === 'all' && day === 'all'} onClick={() => { setStatus('all'); setDay('all'); setPage(1) }} foot={`${expenses.length} פריטים`} />
        <Kpi icon="check" label="שולם" value={paid} tone="teal" d={1} active={status === 'שולם'} onClick={() => reset(setStatus)('שולם')} foot={`${countBy('שולם')} פריטים · ${total ? Math.round((paid / total) * 100) : 0}% מהחודש`} />
        <Kpi icon="clock" label="שולם חלקית" value={partial} tone="orange" d={2} active={status === 'שולם חלקית'} onClick={() => reset(setStatus)('שולם חלקית')} foot={`${countBy('שולם חלקית')} פריטים`} />
        <Kpi icon="wallet" label="נותר לשלם" value={unpaid + partial} tone="red" d={3} active={status === 'לא שולם'} onClick={() => reset(setStatus)('לא שולם')} foot={`${countBy('לא שולם')} לא שולמו בכלל`} />
      </div>

      <section className="card card-pad card-in has-mlist" style={{ '--d': 4 }}>
        <div className="toolbar rv" style={{ '--i': 0 }}>
          <Segmented options={statusTabs} value={status} onChange={reset(setStatus)} label="סטטוס" />
          <span className="toolbar-spacer" />
          <SearchInput value={q} onChange={reset(setQ)} placeholder="חיפוש לפי שם או הערה" />
          <Select value={day} options={[{ id: 'all', label: 'כל הימים' }, ...DAY_OPTS]} onChange={reset(setDay)} label="יום חיוב" icon="calendar" align="end" />
        </div>

        {picked.length > 0 && (
          <div className="bulkbar">
            <span>{picked.length} נבחרו</span>
            <span className="toolbar-spacer" />
            <button className="btn btn--ghost btn--sm" onClick={() => markPaid(expenses.filter((e) => pickedSet.has(e.id)))}>
              <Icon name="check" /> סמן כשולם
            </button>
            <button className="btn btn--danger btn--sm" onClick={() => remove(picked)}>
              <Icon name="trash" /> מחיקה
            </button>
            <button className="icon-btn icon-btn--sm cus-bulk-x" onClick={() => setPicked([])} aria-label="ניקוי הבחירה">
              <Icon name="x" />
            </button>
          </div>
        )}

        {/* desktop table */}
        <div className="tbl-wrap rv" style={{ '--i': 1 }}>
          <div className="tbl" style={{ '--cols': '1.4rem minmax(12rem, 2fr) 9rem 7.5rem 9.5rem 8.5rem 2rem', '--min': '54rem' }}>
            <div className="tbl-row tbl-head">
              <Check on={allOnPage} mixed={!allOnPage && someOnPage} label="בחירת כל העמוד" onChange={() => setPicked((p) => (allOnPage ? p.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...p, ...rows.map((r) => r.id)])]))} />
              <SortBtn k="name" sort={sort} setSort={setSort}>שם</SortBtn>
              <SortBtn k="day" sort={sort} setSort={setSort}>יום חיוב</SortBtn>
              <SortBtn k="amount" sort={sort} setSort={setSort}>סכום</SortBtn>
              <span>ספק</span>
              <SortBtn k="status" sort={sort} setSort={setSort}>סטטוס</SortBtn>
              <span />
            </div>
            <div className="tbl-body">
              {rows.map((e, i) => (
                <div key={e.id} className={`tbl-row rv ${pickedSet.has(e.id) ? 'is-selected' : ''} ${e.status === 'שולם' ? 'is-done' : ''}`} style={{ '--i': i + 2 }} role="button" tabIndex={0} onClick={() => setOpenId(e.id)} onKeyDown={(ev) => ev.key === 'Enter' && setOpenId(e.id)}>
                  <Check on={pickedSet.has(e.id)} label={`בחירת ${e.name}`} onChange={(on) => setPicked((p) => (on ? [...p, e.id] : p.filter((x) => x !== e.id)))} />
                  <span className="person">
                    <Avatar name={e.name} tone={e.status === 'שולם' ? 'var(--green-3)' : undefined} />
                    <span className="person-text">
                      <b><Highlight text={e.name} q={s} /></b>
                      <span>{e.notes ? <Highlight text={e.notes} q={s} /> : T.noun}</span>
                    </span>
                  </span>
                  <span><DayPill day={dayOf(e)} onClick={() => save(e, dayPatch(nextDay(dayOf(e))))} /></span>
                  <span className="tbl-num">{ils(amt(e))}</span>
                  <span><MoodPill mood={e.mood} onClick={() => save(e, { mood: nextMood(e.mood || 'happy') })} /></span>
                  <span><StatusPill status={e.status} onClick={() => save(e, { status: nextStatus(e.status) })} /></span>
                  <span className="tbl-end"><Menu items={menuFor(e)} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* phone list */}
        <ul className="mlist">
          {rows.map((e) => (
            <li key={e.id} className={e.status === 'שולם' ? 'is-done' : ''} onClick={() => setOpenId(e.id)}>
              <div className="mlist-top">
                <Avatar name={e.name} />
                <div className="mlist-main">
                  <b><Highlight text={e.name} q={s} /></b>
                  {e.notes && <span>{e.notes}</span>}
                </div>
                <b className="mlist-amt">{ils(amt(e))}</b>
                <span onClick={(ev) => ev.stopPropagation()}><Menu items={menuFor(e)} /></span>
              </div>
              <div className="mlist-pills">
                <StatusPill status={e.status} onClick={() => save(e, { status: nextStatus(e.status) })} />
                <DayPill day={dayOf(e)} onClick={() => save(e, dayPatch(nextDay(dayOf(e))))} />
                <MoodPill mood={e.mood} compact onClick={() => save(e, { mood: nextMood(e.mood || 'happy') })} />
              </div>
            </li>
          ))}
        </ul>

        {rows.length === 0 && (
          <Empty icon={T.icon} title={expenses.length ? 'אין תוצאות' : `אין ${T.title} בחודש הזה`} text={expenses.length ? 'נסה חיפוש או סינון אחר.' : T.empty}>
            {expenses.length ? (
              <button className="btn btn--ghost btn--sm" onClick={() => { setStatus('all'); setDay('all'); setQ('') }}>ניקוי סינון</button>
            ) : (
              <button className="btn btn--primary btn--sm" onClick={() => setForm({})}><Icon name="plus" /> {T.noun} חדשה</button>
            )}
          </Empty>
        )}
        <Pager page={cur} pages={pages} onChange={setPage} total={sorted.length} label="תשלומים" />
      </section>

      <div className="split split--even">
        <section className="card card-pad card-in" style={{ '--d': 5 }}>
          <CardHead title="הגדולים החודש" sub="לפי סכום" icon="star" />
          <ul className="cus-top">
            {top.map((e, i) => (
              <li key={e.id} className="rv" style={{ '--i': i }}>
                <button onClick={() => setOpenId(e.id)}>
                  <span className="cus-rank">{i + 1}</span>
                  <Avatar name={e.name} />
                  <span className="person-text">
                    <b>{e.name}</b>
                    <span>{DAY_LABEL[dayOf(e)]} · {e.status}</span>
                  </span>
                  <b className="tbl-num">{ils(amt(e))}</b>
                </button>
              </li>
            ))}
            {top.length === 0 && <p className="empty">אין עדיין תשלומים</p>}
          </ul>
        </section>
        <section className="card card-pad card-in" style={{ '--d': 6 }}>
          <CardHead title="לפי יום חיוב" sub="כמה צריך לשלם בכל תאריך, וכמה נשאר" icon="calendar" />
          <div className="cus-mix">
            {byDay.map((x, i) => {
              const pct = x.t ? Math.round(((x.t - x.left) / x.t) * 100) : 0
              return (
                <button key={x.d} type="button" className={`cus-mix-row ice-mix-btn rv ${day === x.d ? 'is-on' : ''}`} style={{ '--i': i }} onClick={() => reset(setDay)(day === x.d ? 'all' : x.d)}>
                  <div className="hbar-top">
                    <span>
                      <i className="cus-mix-dot" style={{ background: x.d === 'unknown' ? 'var(--muted-2)' : 'var(--teal-2)' }} />
                      {DAY_LABEL[x.d]} · {x.n} פריטים
                    </span>
                    <b>{ils(x.t)} · נותר {ils(x.left)}</b>
                  </div>
                  <div className="hbar-track">
                    <i style={{ width: `${pct}%`, background: 'var(--green)', animationDelay: `${500 + i * 120}ms` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {open && (
        <Drawer label={open.name} onClose={() => setOpenId(null)}>
          {(close) => (
            <div className="cus-drawer">
              <header className="cus-dh">
                <Avatar name={open.name} className="cus-dh-avatar" />
                <div className="cus-dh-text">
                  <h3>{open.name}</h3>
                  <p><Icon name={T.icon} /> {T.noun}</p>
                  <Pill tone={STATUS_TONE[open.status]}>{open.status}</Pill>
                </div>
                <button className="icon-btn" onClick={close} aria-label="סגירה"><Icon name="x" /></button>
              </header>
              <div className="cus-quick">
                {open.status !== 'שולם' && (
                  <button className="btn btn--primary btn--sm" onClick={() => markPaid([open])}><Icon name="check" /> סמן כשולם</button>
                )}
                <button className="btn btn--ghost btn--sm" onClick={() => setForm(open)}><Icon name="edit" /> עריכה</button>
              </div>
              <div className="cus-facts">
                <div><span>סכום</span><b>{ils(amt(open))}</b></div>
                <div><span>יום חיוב</span><b>{DAY_LABEL[dayOf(open)]}</b></div>
                <div><span>סטטוס</span><b>{open.status}</b></div>
                <div><span>הספק</span><b>{MOODS[open.mood || 'happy']?.emoji} {MOODS[open.mood || 'happy']?.label}</b></div>
              </div>
              <div className="cus-row">
                <span className="cus-label">סטטוס</span>
                <Select value={open.status} options={STATUS_OPTS.map((o) => ({ ...o, dot: TONE_COLOR[STATUS_TONE[o.id]] }))} onChange={(v) => save(open, { status: v })} align="end" />
              </div>
              <div className="cus-row">
                <span className="cus-label">יום חיוב</span>
                <Select value={dayOf(open)} options={DAY_OPTS} onChange={(v) => save(open, dayPatch(v))} align="end" />
              </div>
              <div className="cus-row cus-row--stack">
                <span className="cus-label">כמה הספק לחוץ</span>
                <Chips options={MOOD_OPTS} value={open.mood || 'happy'} onChange={(v) => save(open, { mood: v })} />
              </div>
              <section className="cus-sec">
                <div className="cus-sec-head"><h4>הערות</h4></div>
                <p className="cus-none">{open.notes || 'אין הערות'}</p>
              </section>
              <button className="cus-delete" onClick={() => { close(); remove([open.id]) }}>
                <Icon name="trash" /> מחיקת {T.noun}
              </button>
            </div>
          )}
        </Drawer>
      )}

      {form && (
        <Modal label="טופס" onClose={() => setForm(null)}>
          {(close) => <ExpenseForm initial={form.id ? form : null} T={T} dayOf={dayOf} close={close} onSave={async (v) => {
            const base = { name: v.name, amount: v.amount, notes: v.notes, status: v.status, mood: v.mood, ...dayPatch(v.day) }
            if (form.id) await onSaveExpense({ ...form, ...base })
            else await onSaveExpense({ month_id: activeMonthId, ...base })
            notify?.(form.id ? `נשמר: ${v.name}` : `נוספה ${T.noun}: ${v.name}`, { tone: 'success' })
          }} />}
        </Modal>
      )}
    </div>
  )
}

function ExpenseForm({ initial, T, dayOf, close, onSave }) {
  const [v, setV] = useState(() => ({
    name: initial?.name || '',
    amount: initial ? String(initial.amount ?? '') : '',
    notes: initial?.notes || '',
    status: initial?.status || 'לא שולם',
    mood: initial?.mood || 'happy',
    day: initial ? dayOf(initial) : '10'
  }))
  const [errors, setErrors] = useState({})
  const submit = () => {
    const err = {}
    if (!v.name.trim()) err.name = 'צריך שם'
    if (v.amount === '' || !(Number(v.amount) >= 0)) err.amount = 'צריך סכום'
    setErrors(err)
    if (Object.keys(err).length) return
    onSave({ ...v, name: v.name.trim(), amount: Number(v.amount) || 0 })
    close()
  }
  return (
    <FormModal title={initial ? `עריכת ${T.noun}` : `${T.noun} חדשה`} sub={initial ? initial.name : 'השדות עם * חובה'} icon={initial ? 'edit' : 'plus'} close={close} onSubmit={submit} submitLabel={initial ? 'שמירת שינויים' : 'הוספה'}>
      <Field label="שם *" error={errors.name} full>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={T.ph} autoFocus />
      </Field>
      <Field label="סכום (₪) *" error={errors.amount}>
        <input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0" />
      </Field>
      <Field label="יום חיוב">
        <Select value={v.day} options={DAY_OPTS} onChange={(d) => setV({ ...v, day: d })} />
      </Field>
      <Field label="סטטוס תשלום" full>
        <Chips options={STATUS_OPTS} value={v.status} onChange={(x) => setV({ ...v, status: x })} />
      </Field>
      <Field label="כמה הספק לחוץ" full>
        <Chips options={MOOD_OPTS} value={v.mood} onChange={(x) => setV({ ...v, mood: x })} />
      </Field>
      <Field label="הערות" full>
        <textarea rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="פרטים נוספים (לא חובה)" />
      </Field>
    </FormModal>
  )
}
