/* Daily income helpers, shared by the dashboard calendar and the income page.
   A day's money lives in income_entries (one row per source, channel 'יומי');
   the orders count lives in daily_orders. */

export const DAILY = 'יומי'
export const FIELDS = [
  { key: 'cash', source: 'מזומן', label: 'מזומן', icon: 'coins', tone: '#e0892a' },
  { key: 'bank', source: 'העברה בנקאית', label: 'העברה בנקאית', icon: 'bank', tone: '#a65ad6' },
  { key: 'grow', source: 'משולם / GROW', label: 'סליקה GROW', icon: 'card', tone: '#2c6d85' }
]
export const SOURCE_KEY = Object.fromEntries(FIELDS.map((f) => [f.source, f.key]))
export const WEEKDAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
export const WEEKDAY_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const MONTH_NAME = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export const pad = (n) => String(n).padStart(2, '0')
export const n0 = (v) => Number(v) || 0
export const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** The daily-entry row of one source on one date (the one the quick form edits). */
export const dailyEntryOf = (entries, date, source) => entries.find((e) => String(e.date || '').slice(0, 10) === date && e.source === source && e.channel === DAILY)

/**
 * The month day by day: totals per source, orders, and weeks (Sunday → Saturday).
 * days[i] = { d, date, wd, cash, bank, grow, other, total, orders, filled, past, today, future }
 */
export function buildMonth({ incomeEntries = [], dailyOrders = [], year, month }) {
  const now = new Date()
  const y = year || now.getFullYear()
  const m = month || now.getMonth() + 1
  const daysInMonth = new Date(y, m, 0).getDate()
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m
  const isFuture = new Date(y, m - 1, 1) > now
  const lastDay = isCurrent ? now.getDate() : isFuture ? 0 : daysInMonth
  const prefix = `${y}-${pad(m)}-`

  const orders = Object.fromEntries(dailyOrders.map((o) => [String(o.date).slice(0, 10), n0(o.orders)]))
  const by = {}
  let undated = 0
  for (const e of incomeEntries) {
    const date = String(e.date || '').slice(0, 10)
    if (!date.startsWith(prefix)) {
      undated += n0(e.amount)
      continue
    }
    const b = (by[date] ||= { cash: 0, bank: 0, grow: 0, other: 0, total: 0, entries: [] })
    b[SOURCE_KEY[e.source] || 'other'] += n0(e.amount)
    b.total += n0(e.amount)
    b.entries.push(e)
  }

  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = isoDate(y, m, d)
    const b = by[date] || { cash: 0, bank: 0, grow: 0, other: 0, total: 0, entries: [] }
    const ord = orders[date] || 0
    days.push({ d, date, wd: new Date(y, m - 1, d).getDay(), ...b, orders: ord, filled: b.total > 0 || ord > 0, past: d <= lastDay, today: isCurrent && d === now.getDate(), future: d > lastDay })
  }

  // calendar rows: leading blanks so the 1st sits under its weekday
  const lead = days[0].wd
  const cells = [...Array(lead).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7)
    const real = row.filter(Boolean)
    weeks.push({ cells: row, total: real.reduce((a, x) => a + x.total, 0), orders: real.reduce((a, x) => a + x.orders, 0), from: real[0]?.d, to: real[real.length - 1]?.d })
  }

  const sum = (k) => days.reduce((a, x) => a + x[k], 0)
  const filled = days.filter((x) => x.filled)
  const missing = days.filter((x) => x.past && !x.filled)
  const totals = { total: sum('total'), cash: sum('cash'), bank: sum('bank'), grow: sum('grow'), other: sum('other'), orders: sum('orders') }
  return { y, m, daysInMonth, isCurrent, lastDay, days, weeks, totals, undated, filled, missing }
}

/**
 * Save one day from the quick form. vals = { cash, bank, grow, orders } as strings.
 * Returns true when every write went through.
 */
export async function saveDay({ date, vals, incomeEntries, dailyOrders, activeMonthId, onSaveIncome, onDeleteIncome, onSaveDailyOrders }) {
  let ok = true
  for (const f of FIELDS) {
    const amount = n0(vals[f.key])
    const existing = dailyEntryOf(incomeEntries, date, f.source)
    if (existing && amount === 0) onDeleteIncome?.(existing.id)
    else if (existing && amount !== n0(existing.amount)) ok = (await onSaveIncome({ ...existing, amount })) !== false && ok
    else if (!existing && amount > 0) ok = (await onSaveIncome({ month_id: activeMonthId, source: f.source, amount, channel: DAILY, date })) !== false && ok
  }
  const prevOrders = dailyOrders.find((o) => String(o.date).slice(0, 10) === date)
  const orders = n0(vals.orders)
  if (vals.orders !== '' && orders !== n0(prevOrders?.orders) ) ok = (await onSaveDailyOrders?.({ month_id: activeMonthId, date, orders })) !== false && ok
  else if (vals.orders === '' && prevOrders && n0(prevOrders.orders) !== 0) ok = (await onSaveDailyOrders?.({ month_id: activeMonthId, date, orders: 0 })) !== false && ok
  return ok
}
