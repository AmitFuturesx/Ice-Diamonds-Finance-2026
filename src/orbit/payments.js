/* Every payment of the open month in one shape — shared by the dashboard and the invoices page.
   { uid, cat, id, name, sub, amount, status, dayKey, mood, raw } */
import { computePay, VAT_RATE } from '../lib/payroll'

export const CATS = [
  { id: 'fixed', title: 'הוצאות קבועות', icon: 'receipt', tone: '#2c6d85', page: 'fixed_expenses' },
  { id: 'variable', title: 'הוצאות משתנות', icon: 'card', tone: '#a65ad6', page: 'variable_expenses' },
  { id: 'payroll', title: 'עובדים ושכר', icon: 'users', tone: '#3f9163', page: 'employees' },
  { id: 'debt', title: 'חובות והלוואות', icon: 'bank', tone: '#e0892a', page: 'debts' },
  { id: 'delivery', title: 'שליחויות', icon: 'truck', tone: '#3a87a0', page: 'deliveries' }
]
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]))
export const DAYS = [
  { key: '10', dn: 10, label: '10 לחודש' },
  { key: '15', dn: 15, label: '15 לחודש' },
  { key: '19', dn: 19, label: '19 לחודש' },
  { key: 'unknown', dn: null, label: 'תאריך לא ידוע' }
]
export const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.key, d.label]))
export const DAY_ORDER = { 10: 0, 15: 1, 19: 2, unknown: 3 }
export const UNPAID = 'לא שולם'

const n0 = (v) => Number(v) || 0
export const bucketKey = (n) => (n == null || isNaN(n) ? 'unknown' : String([10, 15, 19].reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p))))
export const fmtDate = (s) => {
  if (!s) return ''
  const p = String(s).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : s
}

/** empMonthById: { [employee_id]: EmployeeMonth } for the open month */
export function buildPayments({ fixedExpenses = [], variableExpenses = [], employees = [], empMonthById = {}, debts = [], deliveries = [] }) {
  return [
    ...fixedExpenses.map((e) => ({ uid: `f${e.id}`, cat: 'fixed', id: e.id, name: e.name, amount: n0(e.amount), status: e.status || UNPAID, dayKey: bucketKey(e.payment_date ? parseInt(e.payment_date, 10) : NaN), mood: e.mood || 'happy', raw: e })),
    ...variableExpenses.map((e) => ({ uid: `v${e.id}`, cat: 'variable', id: e.id, name: e.name, amount: n0(e.amount), status: e.status || UNPAID, dayKey: bucketKey(e.date ? parseInt(String(e.date).split('-')[2], 10) : NaN), mood: e.mood || 'happy', raw: e })),
    ...employees
      .filter((e) => e.active !== false)
      .map((e) => ({ uid: `p${e.id}`, cat: 'payroll', id: e.id, name: e.name, sub: e.role, dayKey: bucketKey(e.payment_day ? parseInt(e.payment_day, 10) : NaN), amount: computePay(e, empMonthById[e.id], employees, empMonthById).total, status: empMonthById[e.id]?.status || UNPAID, raw: e })),
    ...debts.map((d) => ({ uid: `d${d.id}`, cat: 'debt', id: d.id, name: d.name, amount: n0(d.monthly_payment), status: d.status || UNPAID, dayKey: bucketKey(d.payment_date ? parseInt(String(d.payment_date).split('-').pop(), 10) : NaN), mood: d.mood || 'happy', raw: d })),
    ...deliveries.map((d) => ({ uid: `s${d.id}`, cat: 'delivery', id: d.id, name: `${d.route_from} ← ${d.route_to}`, sub: fmtDate(d.date), dayKey: bucketKey(d.payment_day ? parseInt(d.payment_day, 10) : NaN), amount: n0(d.price) * (1 + VAT_RATE), status: d.status || UNPAID, raw: d }))
  ]
}
