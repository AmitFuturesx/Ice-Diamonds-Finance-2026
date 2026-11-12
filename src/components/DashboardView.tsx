import { useEffect, useMemo, useState } from 'react';
import {
  FixedExpense,
  VariableExpense,
  Debt,
  IncomeEntry,
  Delivery,
  PaymentStatus,
  Employee,
  EmployeeMonth,
  Department,
  Month
} from '../types';
import { computePay } from '../lib/payroll';
import { dbService } from '../lib/supabase';
import { ils, pctChange, useCountUp } from '../lib/hooks';
import {
  Card,
  CardHead,
  Kpi,
  Segmented,
  StatusPill,
  MoodChip,
  Drawer,
  Donut,
  Ring,
  BarChart,
  Progress,
  Empty,
  Button,
  TONES,
  nextStatus,
  nextMood
} from '../ui/kit';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Hourglass,
  BarChart3,
  CalendarDays,
  Check,
  Flame,
  PieChart,
  Coins,
  Users,
  Landmark,
  ArrowUpLeft,
  ArrowDownLeft,
  ChevronLeft
} from 'lucide-react';

type Notify = (
  message: string,
  opts?: { tone?: 'success' | 'error' | 'info'; duration?: number; action?: { label: string; run: () => void } }
) => void;

interface DashboardViewProps {
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  deliveries: Delivery[];
  selectedMonthName: string;
  months?: Month[];
  activeMonthId?: string;
  onSaveFixedExpense?: (e: Omit<FixedExpense, 'id'> & { id?: string }) => Promise<void>;
  onSaveVariableExpense?: (e: Omit<VariableExpense, 'id'> & { id?: string }) => Promise<void>;
  onSaveDebt?: (d: Omit<Debt, 'id'> & { id?: string }) => Promise<void>;
  employees?: Employee[];
  employeeMonths?: EmployeeMonth[];
  onOpenEmployees?: () => void;
  onNavigate?: (page: 'debts' | 'income' | 'fixed_expenses' | 'variable_expenses') => void;
  notify?: Notify;
}

const SHORT_MONTH = ['', 'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
const INCOME_SOURCES = ['מקסימוס', 'UPS', 'מזומן', 'העברה בנקאית', 'משולם / GROW'] as const;
const DEPT_LABEL: Record<Department, string> = { freelancer: 'פרילנסרים', sales: 'אנשי מכירות', staff: 'עובדים נוספים' };
const MOOD_RANK: Record<string, number> = { angry: 0, neutral: 1, happy: 2 };
const DAY_ORDER: Record<string, number> = { '10': 0, '15': 1, '19': 2, unknown: 3 };

type Obligation = {
  id: string;
  name: string;
  amount: number;
  status: PaymentStatus;
  dayKey: string;
  source: 'fixed' | 'variable' | 'debt';
  mood: string;
  item: FixedExpense | VariableExpense | Debt;
};

type Totals = { income: number; fixed: number; variable: number; debts: number };

export default function DashboardView({
  fixedExpenses,
  variableExpenses,
  debts,
  incomeEntries,
  selectedMonthName,
  months = [],
  activeMonthId = '',
  onSaveFixedExpense,
  onSaveVariableExpense,
  onSaveDebt,
  employees = [],
  employeeMonths = [],
  onOpenEmployees,
  onNavigate,
  notify
}: DashboardViewProps) {
  // Drawers: one billing day, or a whole-month list (all / remaining / paid)
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [openSummary, setOpenSummary] = useState<'all' | 'remaining' | 'paid' | null>(null);
  const [range, setRange] = useState<'3' | '6' | '12'>('6');

  /* ---------------- this month ---------------- */
  const totalIncome = incomeEntries.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const totalFixed = fixedExpenses.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const totalVariable = variableExpenses.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const totalDebts = debts.reduce((a, c) => a + (Number(c.monthly_payment) || 0), 0);
  const totalExpenses = totalFixed + totalVariable + totalDebts;
  const netBalance = totalIncome - totalExpenses;

  // Every payment of the month (fixed + variable + debt installments), tagged with its billing day
  const BILLING_DAYS = [10, 15, 19];
  const bucketKey = (n: number) =>
    n == null || isNaN(n) ? 'unknown' : String(BILLING_DAYS.reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p)));
  const obligations: Obligation[] = [
    ...fixedExpenses.map((e): Obligation => ({
      id: e.id,
      name: e.name,
      amount: Number(e.amount) || 0,
      status: e.status,
      dayKey: bucketKey(e.payment_date ? parseInt(e.payment_date, 10) : NaN),
      source: 'fixed',
      mood: e.mood || 'happy',
      item: e
    })),
    ...variableExpenses.map((e): Obligation => ({
      id: e.id,
      name: e.name,
      amount: Number(e.amount) || 0,
      status: e.status,
      dayKey: bucketKey(e.date ? parseInt(e.date.split('-')[2], 10) : NaN),
      source: 'variable',
      mood: e.mood || 'happy',
      item: e
    })),
    ...debts.map((d): Obligation => ({
      id: d.id,
      name: d.name,
      amount: Number(d.monthly_payment) || 0,
      status: d.status || 'לא שולם',
      dayKey: bucketKey(d.payment_date ? parseInt(d.payment_date, 10) : NaN),
      source: 'debt',
      mood: d.mood || 'happy',
      item: d
    }))
  ];
  const paid = obligations.filter((o) => o.status === 'שולם').reduce((a, o) => a + o.amount, 0);
  const remaining = obligations.filter((o) => o.status !== 'שולם').reduce((a, o) => a + o.amount, 0);
  const paidPct = paid + remaining > 0 ? (paid / (paid + remaining)) * 100 : 0;

  const days = ['10', '15', '19', 'unknown'].map((k) => {
    const items = obligations.filter((o) => o.dayKey === k);
    const total = items.reduce((a, o) => a + o.amount, 0);
    const left = items.filter((o) => o.status !== 'שולם').reduce((a, o) => a + o.amount, 0);
    return { key: k, items, total, left, count: items.length, openCount: items.filter((o) => o.status !== 'שולם').length };
  });

  // Save a patch back to whichever table the payment lives in
  const saveObligation = (o: Obligation, patch: { mood?: string; status?: PaymentStatus }) => {
    if (o.source === 'fixed') onSaveFixedExpense?.({ ...(o.item as FixedExpense), ...patch });
    if (o.source === 'variable') onSaveVariableExpense?.({ ...(o.item as VariableExpense), ...patch });
    if (o.source === 'debt') onSaveDebt?.({ ...(o.item as Debt), ...patch });
  };
  const markPaid = (o: Obligation) => {
    const prev = o.status;
    saveObligation(o, { status: 'שולם' });
    notify?.(`סומן כשולם: ${o.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => saveObligation(o, { status: prev }) } });
  };
  const sourceLabel = (s: Obligation['source']) => (s === 'fixed' ? 'הוצאה קבועה' : s === 'variable' ? 'הוצאה משתנה' : 'החזר חוב');
  const dayLabel = (k: string) => (k === 'unknown' ? 'תאריך לא ידוע' : `${k} לחודש`);

  // "Pay next": unpaid, the angriest vendor first, then by billing day, then the bigger amount
  const payNext = obligations
    .filter((o) => o.status !== 'שולם')
    .sort(
      (a, b) =>
        (MOOD_RANK[a.mood] ?? 2) - (MOOD_RANK[b.mood] ?? 2) || DAY_ORDER[a.dayKey] - DAY_ORDER[b.dayKey] || b.amount - a.amount
    );

  /* ---------------- history (charts, sparklines, deltas) ---------------- */
  const sorted = useMemo(
    () => [...months].sort((a, b) => a.year - b.year || a.month_number - b.month_number),
    [months]
  );
  const activeIdx = sorted.findIndex((m) => m.id === activeMonthId);
  const window12 = useMemo(
    () => (activeIdx >= 0 ? sorted.slice(Math.max(0, activeIdx - 11), activeIdx + 1) : []),
    [sorted, activeIdx]
  );
  const idsKey = window12.map((m) => m.id).join(',');
  const [hist, setHist] = useState<Record<string, Totals>>({});
  useEffect(() => {
    if (!idsKey) return;
    let alive = true;
    dbService
      .getMonthTotals(idsKey.split(','))
      .then((r) => alive && setHist(r))
      .catch(() => alive && setHist({}));
    return () => {
      alive = false;
    };
  }, [idsKey]);

  // The open month always uses live numbers, so edits show up at once
  const series = window12.map((m) => {
    const t: Totals =
      m.id === activeMonthId
        ? { income: totalIncome, fixed: totalFixed, variable: totalVariable, debts: totalDebts }
        : hist[m.id] || { income: 0, fixed: 0, variable: 0, debts: 0 };
    const exp = t.fixed + t.variable + t.debts;
    return { m, income: t.income, expenses: exp, net: t.income - exp };
  });
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const last6 = series.slice(-6);
  const shown = series.slice(-Number(range));
  const withData = series.filter((s) => s.income || s.expenses);
  const avgNet = withData.length ? withData.reduce((a, s) => a + s.net, 0) / withData.length : 0;

  /* ---------------- payroll ---------------- */
  const empMonthById: Record<string, EmployeeMonth | undefined> = {};
  employeeMonths.forEach((m) => (empMonthById[m.employee_id] = m));
  const payrollRows = employees
    .map((e) => ({
      emp: e,
      total: computePay(e, empMonthById[e.id], employees, empMonthById).total,
      status: (empMonthById[e.id]?.status || 'לא שולם') as PaymentStatus
    }))
    .sort((a, b) => Number(a.status === 'שולם') - Number(b.status === 'שולם') || b.total - a.total);
  const payrollTotal = payrollRows.reduce((a, r) => a + r.total, 0);
  const payrollPaid = payrollRows.filter((r) => r.status === 'שולם').reduce((a, r) => a + r.total, 0);
  const payrollPct = payrollTotal > 0 ? (payrollPaid / payrollTotal) * 100 : 0;

  /* ---------------- donut + income channels ---------------- */
  const pie = [
    { label: 'הכנסות', value: totalIncome, color: '#10b981' },
    { label: 'הוצאות קבועות', value: totalFixed, color: '#d9b455' },
    { label: 'הוצאות משתנות', value: totalVariable, color: '#24316e' },
    { label: 'חובות והלוואות', value: totalDebts, color: '#f43f5e' }
  ];
  const pieTotal = pie.reduce((a, c) => a + c.value, 0);
  const channels = INCOME_SOURCES.map((src) => {
    const sum = incomeEntries.filter((i) => i.source === src).reduce((a, c) => a + (Number(c.amount) || 0), 0);
    return { src, sum, pct: totalIncome > 0 ? (sum / totalIncome) * 100 : 0 };
  }).sort((a, b) => b.sum - a.sum);

  /* ---------------- debts ---------------- */
  const debtRows = [...debts]
    .map((d) => {
      const bal = Number(d.current_balance) || 0;
      const pay = Number(d.monthly_payment) || 0;
      const left = pay > 0 ? Math.max(0, Math.ceil(bal / pay) - 1) : null;
      const orig = Number(d.original_amount) || 0;
      return { d, bal, pay, left, progress: orig > bal && orig > 0 ? ((orig - bal) / orig) * 100 : null };
    })
    .sort((a, b) => b.bal - a.bal);
  const debtBalance = debtRows.reduce((a, r) => a + r.bal, 0);

  /* ---------------- drawers ---------------- */
  const summaryCfg = {
    all: { title: 'כל התשלומים החודש', filter: (_o: Obligation) => true },
    remaining: { title: 'נותר לשלם החודש', filter: (o: Obligation) => o.status !== 'שולם' },
    paid: { title: 'כבר שולם החודש', filter: (o: Obligation) => o.status === 'שולם' }
  } as const;
  const drawerItems = openDay
    ? obligations
        .filter((o) => o.dayKey === openDay)
        .sort((a, b) => Number(a.status === 'שולם') - Number(b.status === 'שולם') || b.amount - a.amount)
    : openSummary
    ? obligations.filter(summaryCfg[openSummary].filter).sort((a, b) => DAY_ORDER[a.dayKey] - DAY_ORDER[b.dayKey] || b.amount - a.amount)
    : [];
  const drawerOpen = !!openDay || !!openSummary;
  const drawerLeft = drawerItems.filter((o) => o.status !== 'שולם').reduce((a, o) => a + o.amount, 0);
  const drawerTotal = drawerItems.reduce((a, o) => a + o.amount, 0);
  const closeDrawer = () => {
    setOpenDay(null);
    setOpenSummary(null);
  };

  const netAnimated = useCountUp(netBalance, 1100, 150);
  const isPositive = netBalance >= 0;
  const expenseRatio = totalIncome > 0 ? Math.min(Math.round((totalExpenses / totalIncome) * 100), 999) : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ============ KPI strip ============ */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <Kpi
          i={0}
          icon={TrendingUp}
          label="הכנסות החודש"
          value={totalIncome}
          tone="green"
          spark={last6.map((s) => s.income)}
          delta={prev ? pctChange(totalIncome, prev.income) : null}
          onClick={onNavigate ? () => onNavigate('income') : undefined}
        />
        <Kpi
          i={1}
          icon={TrendingDown}
          label="הוצאות החודש"
          value={totalExpenses}
          tone="red"
          spark={last6.map((s) => s.expenses)}
          delta={prev ? pctChange(totalExpenses, prev.expenses) : null}
          goodWhenUp={false}
          onClick={() => setOpenSummary('all')}
        />
        <Kpi
          i={2}
          icon={Wallet}
          label="מאזן נטו"
          value={netBalance}
          tone="navy"
          spark={last6.map((s) => s.net)}
          delta={prev ? pctChange(netBalance, prev.net) : null}
        />
        <Kpi
          i={3}
          icon={Hourglass}
          label="נותר לשלם"
          value={remaining}
          tone="amber"
          onClick={() => setOpenSummary('remaining')}
          foot={
            <div className="space-y-1.5 pt-1">
              <Progress value={paidPct} color={TONES.green} />
              <div className="flex justify-between">
                <span>{paidPct.toFixed(0)}% כבר שולם</span>
                <span className="num">{ils(paid)}</span>
              </div>
            </div>
          }
        />
      </div>

      {/* ============ Cash flow + balance ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        <Card className="xl:col-span-8 p-5 sm:p-6">
          <CardHead icon={BarChart3} title="תזרים: הכנסות מול הוצאות" sub="לפי חודש · החודש הפתוח מודגש">
            <Segmented
              size="sm"
              label="טווח"
              value={range}
              onChange={setRange}
              options={[
                { id: '3', label: '3 חודשים' },
                { id: '6', label: '6' },
                { id: '12', label: '12' }
              ]}
            />
          </CardHead>
          <div className="flex items-center gap-4 mt-4 mb-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: TONES.navy }} />
              הכנסות
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: '#d9b455' }} />
              הוצאות
            </span>
          </div>
          {shown.length ? (
            <div key={range}>
            <BarChart
              height={250}
              labels={shown.map((s) => SHORT_MONTH[s.m.month_number] || s.m.name)}
              highlight={shown.length - 1}
              series={[
                { name: 'הכנסות', color: TONES.navy, values: shown.map((s) => s.income) },
                { name: 'הוצאות', color: '#d9b455', values: shown.map((s) => s.expenses) }
              ]}
            />
            </div>
          ) : (
            <Empty title="אין עדיין היסטוריה" text="כשיהיו כמה חודשים במערכת, הגרף יראה את המגמה." />
          )}
        </Card>

        {/* Navy balance card */}
        <div
          className="xl:col-span-4 rounded-[1.6rem] p-6 relative overflow-hidden text-white flex flex-col shadow-[0_24px_50px_-24px_rgb(22_32_79_/_0.7)] min-h-[300px]"
          style={{
            background:
              'radial-gradient(26rem 16rem at 0% 0%, rgb(217 180 85 / 0.24), transparent 60%), linear-gradient(155deg, #2a377a 0%, #1b2660 52%, #16204f 100%)'
          }}
        >
          <svg className="absolute inset-x-0 bottom-0 w-full h-32 opacity-[0.14] pointer-events-none" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 70 C 60 40, 110 90, 170 60 S 290 20, 400 50 L 400 100 L 0 100 Z" fill="#d9b455" />
          </svg>
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-xs text-white/65 font-medium">מאזן החודש · {selectedMonthName}</span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isPositive ? 'bg-emerald-400/15 text-[#86efac]' : 'bg-rose-400/15 text-[#fda4af]'
              }`}
            >
              {isPositive ? <ArrowUpLeft className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
              {isPositive ? 'חודש רווחי' : 'גרעון'}
            </span>
          </div>
          <b className={`relative num text-[40px] sm:text-[46px] font-black tracking-tight leading-none mt-4 ${isPositive ? 'text-white' : 'text-[#fda4af]'}`}>
            {ils(netAnimated)}
          </b>
          <span className="relative text-xs text-white/55 mt-2">הכנסות פחות כל ההוצאות וההחזרים</span>

          <div className="relative grid grid-cols-2 gap-2.5 mt-6">
            <div className="rounded-2xl bg-white/[0.08] border border-white/10 px-3.5 py-3">
              <div className="text-[11px] text-white/55">נכנס</div>
              <div className="text-base font-bold num">{ils(totalIncome)}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.08] border border-white/10 px-3.5 py-3">
              <div className="text-[11px] text-white/55">יצא</div>
              <div className="text-base font-bold num">{ils(totalExpenses)}</div>
            </div>
          </div>

          <div className="relative mt-auto pt-6">
            <div className="flex justify-between text-xs text-white/65 mb-1.5">
              <span>הוצאות מתוך ההכנסות</span>
              <span className={expenseRatio > 80 ? 'text-[#fda4af] font-bold' : 'text-gold font-bold'}>{expenseRatio}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full grow-x ${expenseRatio > 80 ? 'bg-rose-400' : 'bg-gold'}`}
                style={{ width: `${Math.min(100, expenseRatio)}%` }}
              />
            </div>
            {withData.length > 1 && (
              <div className="text-[11px] text-white/55 mt-3">
                ממוצע מאזן ב־{withData.length} החודשים האחרונים: <b className="text-white num">{ils(avgNet)}</b>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ Payment schedule + pay next ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        <Card className="xl:col-span-8 p-5 sm:p-6">
          <CardHead icon={CalendarDays} title="לוח תשלומים לפי יום חיוב" sub="הוצאות קבועות, משתנות והחזרי חובות · לחיצה פותחת פירוט">
            <Ring value={paidPct} size={54} stroke={6}>
              <span className="text-[11px] font-extrabold text-ink num">{paidPct.toFixed(0)}%</span>
            </Ring>
          </CardHead>

          <div className="grid grid-cols-3 gap-2 mt-5">
            {(
              [
                { k: 'all', label: 'סה״כ לתשלום', v: paid + remaining, cls: 'text-ink' },
                { k: 'remaining', label: 'נותר', v: remaining, cls: 'text-rose-600' },
                { k: 'paid', label: 'שולם', v: paid, cls: 'text-emerald-600' }
              ] as const
            ).map((s) => (
              <button
                key={s.k}
                type="button"
                onClick={() => setOpenSummary(s.k)}
                className="text-right rounded-2xl bg-panel hover:bg-[#ebeff6] px-3 sm:px-4 py-3 transition-colors cursor-pointer min-w-0"
              >
                <div className="text-[11px] sm:text-xs text-muted">{s.label}</div>
                <div className={`text-[15px] sm:text-xl font-extrabold num truncate ${s.cls}`}>{ils(s.v)}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {days.map((d) => {
              const pct = d.total > 0 ? ((d.total - d.left) / d.total) * 100 : 0;
              const done = d.total > 0 && d.left === 0;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setOpenDay(d.key)}
                  className="group text-right rounded-2xl border border-line hover:border-navy/25 hover:shadow-card bg-white p-4 transition-all cursor-pointer flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      {d.key === 'unknown' ? (
                        <b className="text-base sm:text-lg font-extrabold text-ink-2 whitespace-nowrap">לא ידוע</b>
                      ) : (
                        <>
                          <b className="text-[28px] font-black text-navy leading-none num">{d.key}</b>
                          <span className="text-xs text-muted">לחודש</span>
                        </>
                      )}
                    </div>
                    <span
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        done ? 'bg-emerald-50 text-emerald-600' : d.openCount ? 'bg-rose-50 text-rose-600' : 'bg-panel text-muted'
                      }`}
                    >
                      {done ? 'הכל שולם' : d.openCount ? `${d.openCount} פתוחים` : 'אין'}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-ink num">{ils(d.total)}</div>
                    <div className="text-[11.5px] text-muted">
                      נותר <b className={`num ${d.left > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{ils(d.left)}</b>
                    </div>
                  </div>
                  <Progress value={pct} color={done ? TONES.green : TONES.navy} />
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="xl:col-span-4 p-5 sm:p-6 flex flex-col">
          <CardHead icon={Flame} title="לשלם עכשיו" sub="קודם מי שהכי לחוץ, אחר כך לפי תאריך">
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-600">{payNext.length}</span>
          </CardHead>
          {payNext.length === 0 ? (
            <Empty icon={Check} title="הכל שולם החודש" text="אין תשלומים פתוחים. יפה מאוד." />
          ) : (
            <ul className="mt-4 space-y-1.5 flex-1">
              {payNext.slice(0, 6).map((o) => (
                <li key={o.source + o.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-panel transition-colors">
                  <button
                    type="button"
                    onClick={() => markPaid(o)}
                    title="סמן כשולם"
                    aria-label={`סמן כשולם: ${o.name}`}
                    className="w-8 h-8 shrink-0 rounded-full border-2 border-line text-transparent hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 grid place-items-center transition-all cursor-pointer active:scale-90"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink truncate">{o.name}</div>
                    <div className="text-[11px] text-muted truncate">
                      {sourceLabel(o.source)} · {dayLabel(o.dayKey)}
                    </div>
                  </div>
                  <MoodChip mood={o.mood} compact onClick={() => saveObligation(o, { mood: nextMood(o.mood) })} />
                  <b className="text-sm font-bold text-ink num w-[4.8rem] text-left shrink-0">{ils(o.amount)}</b>
                </li>
              ))}
            </ul>
          )}
          {payNext.length > 6 && (
            <Button variant="soft" size="sm" className="mt-3 w-full" onClick={() => setOpenSummary('remaining')}>
              עוד {payNext.length - 6} תשלומים פתוחים
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          )}
        </Card>
      </div>

      {/* ============ Where the money went + income sources ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        <Card className="xl:col-span-5 p-5 sm:p-6">
          <CardHead icon={PieChart} title="לאן הלך הכסף" sub="הכנסות והוצאות החודש לפי קטגוריה" />
          {pieTotal === 0 ? (
            <Empty title="אין נתונים לחודש הזה" />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-5">
              <Donut
                segments={pie}
                size={176}
                center={
                  <div>
                    <div className="text-[11px] text-muted">סה״כ תנועה</div>
                    <div className="text-base font-extrabold text-ink num">{ils(pieTotal)}</div>
                  </div>
                }
              />
              <ul className="flex-1 w-full space-y-2.5">
                {pie.map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5">
                    <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-sm text-ink-2 flex-1 truncate">{s.label}</span>
                    <b className="text-sm text-ink num">{ils(s.value)}</b>
                    <span className="text-[11px] font-bold text-muted w-9 text-left num">
                      {pieTotal ? ((s.value / pieTotal) * 100).toFixed(0) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-7 p-5 sm:p-6">
          <CardHead icon={Coins} title="מקורות הכנסה" sub={`סה״כ ${ils(totalIncome)} החודש`}>
            {onNavigate && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('income')}>
                לכל ההכנסות
              </Button>
            )}
          </CardHead>
          <ul className="mt-5 space-y-4">
            {channels.map((c, i) => (
              <li key={c.src}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-ink">{c.src}</span>
                  <span className="flex items-center gap-2">
                    <b className="num text-ink">{ils(c.sum)}</b>
                    <span className="text-[11px] font-bold text-muted w-9 text-left num">{c.pct.toFixed(0)}%</span>
                  </span>
                </div>
                <Progress value={c.pct} color={i === 0 ? TONES.navy : i === 1 ? '#d9b455' : '#9aa6c8'} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ============ Payroll + debts ============ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        <Card className="xl:col-span-7 p-5 sm:p-6">
          <CardHead icon={Users} title="עובדים ושכר החודש" sub="כמה מגיע לכל אחד וכמה כבר שולם">
            {onOpenEmployees && (
              <Button variant="ghost" size="sm" onClick={onOpenEmployees}>
                לניהול עובדים
              </Button>
            )}
          </CardHead>
          {employees.length === 0 ? (
            <Empty title="עוד לא הוגדרו עובדים" text="מוסיפים אותם במסך ״עובדים ושכר״." />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 mt-5">
                <Ring value={payrollPct} size={116} stroke={11} color={TONES.navy}>
                  <div>
                    <div className="text-lg font-extrabold text-ink num">{payrollPct.toFixed(0)}%</div>
                    <div className="text-[10.5px] text-muted">שולם</div>
                  </div>
                </Ring>
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <div className="rounded-2xl bg-panel px-3 py-3 min-w-0">
                    <div className="text-[11px] text-muted">סה״כ שכר</div>
                    <div className="text-[15px] sm:text-lg font-extrabold text-ink num truncate">{ils(payrollTotal)}</div>
                  </div>
                  <div className="rounded-2xl bg-panel px-3 py-3 min-w-0">
                    <div className="text-[11px] text-muted">נותר</div>
                    <div className="text-[15px] sm:text-lg font-extrabold text-rose-600 num truncate">{ils(payrollTotal - payrollPaid)}</div>
                  </div>
                  <div className="rounded-2xl bg-panel px-3 py-3 min-w-0">
                    <div className="text-[11px] text-muted">שולם</div>
                    <div className="text-[15px] sm:text-lg font-extrabold text-emerald-600 num truncate">{ils(payrollPaid)}</div>
                  </div>
                  {(Object.keys(DEPT_LABEL) as Department[]).map((dep) => {
                    const rows = payrollRows.filter((r) => r.emp.department === dep);
                    return (
                      <div key={dep} className="rounded-xl border border-line px-3 py-2 min-w-0">
                        <div className="text-[10.5px] text-muted truncate">
                          {DEPT_LABEL[dep]} · {rows.length}
                        </div>
                        <div className="text-sm font-bold text-ink num truncate">{ils(rows.reduce((a, r) => a + r.total, 0))}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <ul className="mt-4 divide-y divide-line max-h-64 overflow-y-auto">
                {payrollRows.map((r) => (
                  <li key={r.emp.id} className={`flex items-center gap-3 py-2.5 ${r.status === 'שולם' ? 'opacity-55' : ''}`}>
                    <span className="w-8 h-8 rounded-full bg-gold-soft text-gold-2 grid place-items-center text-xs font-black shrink-0">
                      {r.emp.name.trim().charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink truncate">{r.emp.name}</div>
                      <div className="text-[11px] text-muted truncate">{r.emp.role || DEPT_LABEL[r.emp.department]}</div>
                    </div>
                    <b className="text-sm text-ink num">{ils(r.total)}</b>
                    <StatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="xl:col-span-5 p-5 sm:p-6">
          <CardHead icon={Landmark} title="חובות והלוואות" sub={`יתרה כוללת ${ils(debtBalance)}`}>
            {onNavigate && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('debts')}>
                לכל החובות
              </Button>
            )}
          </CardHead>
          {debtRows.length === 0 ? (
            <Empty title="אין חובות החודש" />
          ) : (
            <ul className="mt-4 space-y-3">
              {debtRows.slice(0, 6).map((r) => (
                <li key={r.d.id} className="rounded-2xl border border-line px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink truncate">{r.d.name}</span>
                    <b className="text-sm text-ink num shrink-0">{ils(r.bal)}</b>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1 text-[11.5px] text-muted">
                    <span>
                      החזר <b className="text-ink-2 num">{ils(r.pay)}</b> לחודש
                    </span>
                    {r.left !== null && (
                      <span className={`font-semibold ${r.left === 0 ? 'text-emerald-600' : 'text-navy'}`}>
                        {r.left === 0 ? 'תשלום אחרון' : `עוד ${r.left} תשלומים`}
                      </span>
                    )}
                  </div>
                  {r.progress !== null && <Progress className="mt-2" value={r.progress} color={TONES.gold} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ============ Drawer: one billing day / a whole-month list ============ */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        icon={CalendarDays}
        title={openDay ? `תשלומים · ${dayLabel(openDay)}` : openSummary ? summaryCfg[openSummary].title : ''}
        sub={
          <>
            {drawerItems.length} פריטים · סה״כ <b className="text-ink num">{ils(drawerTotal)}</b>
            {drawerLeft > 0 && (
              <>
                {' '}
                · נותר <b className="text-rose-600 num">{ils(drawerLeft)}</b>
              </>
            )}
          </>
        }
        footer={
          <div className="text-[11.5px] text-muted leading-relaxed">
            לחיצה על הסטטוס מחליפה אותו (לא שולם ← שולם חלקית ← שולם). לחיצה על הפרצוף מעדכנת כמה הספק לחוץ: 😊 רגוע · 😐 העיר על זה · 😠 דורש את הכסף
          </div>
        }
      >
        {drawerItems.length === 0 ? (
          <Empty icon={Check} title="אין תשלומים כאן" />
        ) : (
          <ul className="space-y-2">
            {drawerItems.map((o) => {
              const isPaid = o.status === 'שולם';
              return (
                <li
                  key={o.source + o.id}
                  className={`rounded-2xl border border-line px-4 py-3 transition-opacity ${isPaid ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold text-ink truncate ${isPaid ? 'line-through decoration-muted' : ''}`}>{o.name}</div>
                      <div className="text-[11px] text-muted">
                        {sourceLabel(o.source)}
                        {openSummary ? ` · ${dayLabel(o.dayKey)}` : ''}
                      </div>
                    </div>
                    <b className={`text-sm num shrink-0 ${isPaid ? 'text-muted' : 'text-ink'}`}>{ils(o.amount)}</b>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <StatusPill status={o.status} onClick={() => saveObligation(o, { status: nextStatus(o.status) })} />
                    <MoodChip mood={o.mood} onClick={() => saveObligation(o, { mood: nextMood(o.mood) })} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
