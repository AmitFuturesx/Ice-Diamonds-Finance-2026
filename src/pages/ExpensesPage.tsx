/* Fixed + variable expenses share one page; only how the billing day is stored differs. */
import { FormEvent, useState } from 'react';
import { FixedExpense, VariableExpense, PaymentStatus } from '../types';
import { useTable, TableSearch, SortTh } from '../components/TableControls';
import { ils } from '../lib/hooks';
import {
  Card,
  StatTile,
  Segmented,
  StatusPill,
  MoodChip,
  DayChip,
  RowMenu,
  Drawer,
  Field,
  ChoiceChips,
  Button,
  Empty,
  Progress,
  inputCls,
  TONES,
  BillingDay,
  BILLING_OPTIONS,
  nextBillingDay,
  snapDay,
  nextStatus,
  nextMood
} from '../ui/kit';
import {
  Wallet,
  CheckCircle2,
  CircleDashed,
  Hourglass,
  Plus,
  Pencil,
  Trash2,
  Check,
  FileText,
  CreditCard,
  X,
  SearchX
} from 'lucide-react';

type Kind = 'fixed' | 'variable';
type Item = FixedExpense | VariableExpense;
type Notify = (m: string, o?: { tone?: 'success' | 'error' | 'info'; duration?: number; action?: { label: string; run: () => void } }) => void;

interface Props {
  kind: Kind;
  expenses: Item[];
  activeMonthId: string;
  monthYear?: number;
  monthNumber?: number;
  onSaveExpense: (e: any) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  notify?: Notify;
}

const TEXT = {
  fixed: {
    noun: 'הוצאה קבועה',
    add: 'הוצאה קבועה חדשה',
    empty: 'אין הוצאות קבועות בחודש הזה',
    emptyText: 'שכירות, ארנונה, תקשורת, ביטוחים — כל מה שחוזר כל חודש.',
    placeholder: 'לדוגמה: שכירות חנות',
    icon: FileText
  },
  variable: {
    noun: 'הוצאה משתנה',
    add: 'הוצאה משתנה חדשה',
    empty: 'אין הוצאות משתנות בחודש הזה',
    emptyText: 'רכש, פרסום, תיקונים — כל מה שמשתנה מחודש לחודש.',
    placeholder: 'לדוגמה: חומרי גלם',
    icon: CreditCard
  }
} as const;

type StatusFilter = 'all' | PaymentStatus;
const STATUS_OPTIONS: { id: PaymentStatus; label: string }[] = [
  { id: 'לא שולם', label: 'לא שולם' },
  { id: 'שולם חלקית', label: 'שולם חלקית' },
  { id: 'שולם', label: 'שולם' }
];
const DAY_ORDER: Record<string, number> = { '10': 0, '15': 1, '19': 2, unknown: 3 };
const STATUS_ORDER: Record<string, number> = { 'לא שולם': 0, 'שולם חלקית': 1, 'שולם': 2 };

export default function ExpensesPage({ kind, expenses, activeMonthId, monthYear, monthNumber, onSaveExpense, onDeleteExpense, notify }: Props) {
  const T = TEXT[kind];
  const pad = (n: number) => String(n).padStart(2, '0');

  /* ---- billing day: fixed keeps "10"/"" in payment_date, variable keeps a full date ---- */
  const dayOf = (e: Item): BillingDay =>
    kind === 'fixed'
      ? snapDay((e as FixedExpense).payment_date ? parseInt((e as FixedExpense).payment_date as string, 10) : NaN)
      : snapDay((e as VariableExpense).date ? parseInt((e as VariableExpense).date.split('-')[2], 10) : NaN);
  const dayPatch = (d: BillingDay) => {
    if (kind === 'fixed') return { payment_date: d === 'unknown' ? '' : String(d) };
    if (d === 'unknown') return { date: '' };
    const y = monthYear || new Date().getFullYear();
    const m = monthNumber || new Date().getMonth() + 1;
    return { date: `${y}-${pad(m)}-${pad(d)}` };
  };

  /* ---- quick actions ---- */
  const save = (e: Item, patch: Partial<Item> & Record<string, unknown>) => onSaveExpense({ ...e, ...patch });
  const markPaid = (e: Item) => {
    const prev = e.status;
    save(e, { status: 'שולם' });
    notify?.(`סומן כשולם: ${e.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => save(e, { status: prev }) } });
  };

  /* ---- totals ---- */
  const amt = (e: Item) => Number(e.amount) || 0;
  const sumBy = (s: PaymentStatus) => expenses.filter((e) => e.status === s).reduce((a, e) => a + amt(e), 0);
  const countBy = (s: PaymentStatus) => expenses.filter((e) => e.status === s).length;
  const total = expenses.reduce((a, e) => a + amt(e), 0);
  const paid = sumBy('שולם');
  const partial = sumBy('שולם חלקית');
  const unpaid = sumBy('לא שולם');
  const paidPct = total > 0 ? (paid / total) * 100 : 0;

  const days = BILLING_OPTIONS.map((d) => {
    const items = expenses.filter((e) => dayOf(e) === d);
    const sum = items.reduce((a, e) => a + amt(e), 0);
    const left = items.filter((e) => e.status !== 'שולם').reduce((a, e) => a + amt(e), 0);
    return { d, sum, left, count: items.length };
  });

  /* ---- filters + table ---- */
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dayFilter, setDayFilter] = useState<BillingDay | null>(null);
  const filtered = expenses.filter((e) => (status === 'all' || e.status === status) && (dayFilter === null || dayOf(e) === dayFilter));
  const { view, query, setQuery, sort, toggleSort } = useTable(
    filtered,
    (e) => `${e.name} ${e.notes || ''}`,
    {
      name: (e) => e.name,
      amount: (e) => amt(e),
      day: (e) => DAY_ORDER[String(dayOf(e))],
      status: (e) => STATUS_ORDER[e.status] ?? 0
    }
  );
  const viewTotal = view.reduce((a, e) => a + amt(e), 0);
  const hasFilter = status !== 'all' || dayFilter !== null || !!query;
  const clearFilters = () => {
    setStatus('all');
    setDayFilter(null);
    setQuery('');
  };

  /* ---- drawer (add / edit) ---- */
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', notes: '', status: 'לא שולם' as PaymentStatus, day: 10 as BillingDay, mood: 'happy' });
  const [saving, setSaving] = useState(false);
  const openNew = () => {
    setForm({ name: '', amount: '', notes: '', status: 'לא שולם', day: dayFilter ?? 10, mood: 'happy' });
    setEditing('new');
  };
  const openEdit = (e: Item) => {
    setForm({ name: e.name, amount: String(e.amount ?? ''), notes: e.notes || '', status: e.status, day: dayOf(e), mood: e.mood || 'happy' });
    setEditing(e);
  };
  const submit = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (!form.name.trim() || form.amount === '') return;
    setSaving(true);
    const base = { name: form.name.trim(), amount: Number(form.amount) || 0, notes: form.notes, status: form.status, mood: form.mood, ...dayPatch(form.day) };
    try {
      if (editing === 'new') await onSaveExpense({ month_id: activeMonthId, ...base });
      else if (editing) await onSaveExpense({ ...editing, ...base });
      notify?.(editing === 'new' ? `נוספה ${T.noun}: ${base.name}` : `נשמר: ${base.name}`, { tone: 'success' });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const menuFor = (e: Item) => [
    { id: 'edit', label: 'עריכה', icon: Pencil, onClick: () => openEdit(e) },
    ...(e.status !== 'שולם' ? [{ id: 'paid', label: 'סמן כשולם', icon: Check, onClick: () => markPaid(e) }] : []),
    { id: 'del', label: 'מחיקה', icon: Trash2, danger: true, onClick: () => onDeleteExpense(e.id) }
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* KPI tiles — each one filters the table */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <StatTile i={0} icon={Wallet} label="סה״כ החודש" value={total} tone="navy" active={status === 'all' && dayFilter === null} onClick={() => setStatus('all')} sub={`${expenses.length} פריטים`} />
        <StatTile i={1} icon={CheckCircle2} label="שולם" value={paid} tone="green" active={status === 'שולם'} onClick={() => setStatus('שולם')} sub={`${countBy('שולם')} פריטים · ${paidPct.toFixed(0)}%`} />
        <StatTile i={2} icon={CircleDashed} label="שולם חלקית" value={partial} tone="amber" active={status === 'שולם חלקית'} onClick={() => setStatus('שולם חלקית')} sub={`${countBy('שולם חלקית')} פריטים`} />
        <StatTile i={3} icon={Hourglass} label="נותר לשלם" value={unpaid + partial} tone="red" active={status === 'לא שולם'} onClick={() => setStatus('לא שולם')} sub={`${countBy('לא שולם')} לא שולמו בכלל`} />
      </div>

      {/* Billing-day strip — click to filter by day */}
      <div className="no-scrollbar flex gap-3 overflow-x-auto snap-x -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {days.map(({ d, sum, left, count }) => {
          const on = dayFilter === d;
          const pct = sum > 0 ? ((sum - left) / sum) * 100 : 0;
          return (
            <button
              key={String(d)}
              type="button"
              aria-pressed={on}
              onClick={() => setDayFilter(on ? null : d)}
              className={`shrink-0 w-[10.5rem] snap-start lg:w-auto text-right rounded-[1.3rem] p-4 flex flex-col gap-2.5 transition-all cursor-pointer ${
                on ? 'bg-navy text-white shadow-pop' : 'bg-white shadow-card hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-baseline gap-1">
                  {d === 'unknown' ? (
                    <b className="text-[15px] font-extrabold whitespace-nowrap">לא ידוע</b>
                  ) : (
                    <>
                      <b className={`text-2xl font-black leading-none num ${on ? 'text-gold' : 'text-navy'}`}>{d}</b>
                      <span className={`text-xs ${on ? 'text-white/70' : 'text-muted'}`}>לחודש</span>
                    </>
                  )}
                </span>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${on ? 'bg-white/15 text-white' : 'bg-panel text-muted'}`}>
                  {count}
                </span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <b className="text-base sm:text-lg font-extrabold num">{ils(sum)}</b>
                <span className={`text-[11px] ${on ? 'text-white/70' : 'text-muted'}`}>
                  נותר <b className={`num ${left > 0 ? (on ? 'text-[#fda4af]' : 'text-rose-600') : on ? 'text-[#86efac]' : 'text-emerald-600'}`}>{ils(left)}</b>
                </span>
              </div>
              <Progress value={pct} color={on ? '#d9b455' : TONES.green} className={on ? '!bg-white/15' : ''} />
            </button>
          );
        })}
      </div>

      {/* Main table card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 sm:p-5 border-b border-line">
          <Segmented
            full
            label="סינון לפי סטטוס"
            value={status}
            onChange={setStatus}
            options={[
              { id: 'all', label: 'הכל', count: expenses.length },
              { id: 'לא שולם', label: 'לא שולם', count: countBy('לא שולם') },
              { id: 'שולם חלקית', label: 'חלקית', count: countBy('שולם חלקית') },
              { id: 'שולם', label: 'שולם', count: countBy('שולם') }
            ]}
          />
          <div className="flex items-center gap-2 lg:ms-auto">
            <TableSearch value={query} onChange={setQuery} placeholder="חיפוש לפי שם או הערה" count={view.length} total={filtered.length} />
            <Button icon={Plus} onClick={openNew} className="shrink-0">
              <span className="hidden sm:inline">הוספה</span>
            </Button>
          </div>
        </div>

        {hasFilter && (
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-2.5 bg-panel/60 border-b border-line text-xs">
            <span className="text-muted">מסונן:</span>
            {status !== 'all' && <FilterChip label={status} onClear={() => setStatus('all')} />}
            {dayFilter !== null && <FilterChip label={dayFilter === 'unknown' ? 'תאריך לא ידוע' : `${dayFilter} לחודש`} onClear={() => setDayFilter(null)} />}
            {query && <FilterChip label={`"${query}"`} onClear={() => setQuery('')} />}
            <button type="button" onClick={clearFilters} className="text-navy font-semibold hover:underline cursor-pointer ms-1">
              ניקוי הכל
            </button>
          </div>
        )}

        {expenses.length === 0 ? (
          <Empty icon={T.icon} title={T.empty} text={T.emptyText}>
            <Button icon={Plus} onClick={openNew}>
              {T.add}
            </Button>
          </Empty>
        ) : view.length === 0 ? (
          <Empty icon={SearchX} title="אין תוצאות" text="אף פריט לא מתאים לסינון הנוכחי.">
            <Button variant="soft" onClick={clearFilters}>
              ניקוי סינון
            </Button>
          </Empty>
        ) : (
          <>
            {/* desktop table */}
            <table className="hidden md:table w-full text-right text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-line">
                  <SortTh label="שם" sortKey="name" sort={sort} onSort={toggleSort} className="w-[34%]" />
                  <SortTh label="יום חיוב" sortKey="day" sort={sort} onSort={toggleSort} />
                  <SortTh label="סכום" sortKey="amount" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3 font-semibold">ספק</th>
                  <SortTh label="סטטוס" sortKey="status" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3 w-12" aria-label="פעולות" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => openEdit(e)}
                    className={`group cursor-pointer transition-colors hover:bg-panel/70 ${e.status === 'שולם' ? 'text-muted' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className={`font-semibold ${e.status === 'שולם' ? 'text-ink-2' : 'text-ink'}`}>{e.name}</div>
                      {e.notes && <div className="text-xs text-muted truncate max-w-[22rem]">{e.notes}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <DayChip day={dayOf(e)} onClick={() => save(e, dayPatch(nextBillingDay(dayOf(e))))} />
                    </td>
                    <td className="px-4 py-3.5 font-bold text-ink num">{ils(amt(e))}</td>
                    <td className="px-4 py-3.5">
                      <MoodChip mood={e.mood} onClick={() => save(e, { mood: nextMood(e.mood || 'happy') })} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={e.status} onClick={() => save(e, { status: nextStatus(e.status) })} />
                    </td>
                    <td className="px-2 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                      <RowMenu items={menuFor(e)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-panel/50 text-sm">
                  <td className="px-4 py-3 text-muted" colSpan={2}>
                    {view.length} פריטים מוצגים
                  </td>
                  <td className="px-4 py-3 font-extrabold text-ink num" colSpan={4}>
                    {ils(viewTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* mobile list */}
            <ul className="md:hidden divide-y divide-line">
              {view.map((e) => (
                <li key={e.id} onClick={() => openEdit(e)} className="px-4 py-3.5 active:bg-panel cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold truncate ${e.status === 'שולם' ? 'text-ink-2' : 'text-ink'}`}>{e.name}</div>
                      {e.notes && <div className="text-xs text-muted truncate">{e.notes}</div>}
                    </div>
                    <b className="text-ink num shrink-0">{ils(amt(e))}</b>
                    <div onClick={(ev) => ev.stopPropagation()} className="-me-2 -mt-1">
                      <RowMenu items={menuFor(e)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <StatusPill status={e.status} onClick={() => save(e, { status: nextStatus(e.status) })} />
                    <DayChip day={dayOf(e)} onClick={() => save(e, dayPatch(nextBillingDay(dayOf(e))))} />
                    <MoodChip mood={e.mood} compact onClick={() => save(e, { mood: nextMood(e.mood || 'happy') })} />
                  </div>
                </li>
              ))}
              <li className="px-4 py-3 bg-panel/50 flex justify-between text-sm">
                <span className="text-muted">{view.length} פריטים</span>
                <b className="text-ink num">{ils(viewTotal)}</b>
              </li>
            </ul>
          </>
        )}
      </Card>

      {/* Add / edit drawer */}
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        icon={T.icon}
        title={editing === 'new' ? T.add : 'עריכת ' + T.noun}
        sub={editing && editing !== 'new' ? editing.name : 'כל השדות עם * חובה'}
        footer={
          <>
            <Button type="submit" form="expense-form" disabled={saving || !form.name.trim() || form.amount === ''} className="flex-1">
              {saving ? 'שומר...' : editing === 'new' ? 'הוספה' : 'שמירת שינויים'}
            </Button>
            {editing && editing !== 'new' && (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  const id = editing.id;
                  setEditing(null);
                  onDeleteExpense(id);
                }}
              >
                מחיקה
              </Button>
            )}
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="שם *" full>
            <input
              autoFocus
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={T.placeholder}
            />
          </Field>
          <Field label="סכום (₪) *" full>
            <input
              type="number"
              inputMode="decimal"
              className={`${inputCls} num text-lg font-bold`}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="יום חיוב" full>
            <ChoiceChips
              value={form.day}
              onChange={(d) => setForm({ ...form, day: d })}
              options={BILLING_OPTIONS.map((d) => ({ id: d, label: d === 'unknown' ? 'לא ידוע' : `${d} לחודש` }))}
            />
          </Field>
          <Field label="סטטוס תשלום" full>
            <ChoiceChips value={form.status} onChange={(s) => setForm({ ...form, status: s })} options={STATUS_OPTIONS} />
          </Field>
          <Field label="כמה הספק לחוץ" full>
            <ChoiceChips
              value={form.mood}
              onChange={(m) => setForm({ ...form, mood: m })}
              options={[
                { id: 'happy', label: '😊 רגוע' },
                { id: 'neutral', label: '😐 העיר על זה' },
                { id: 'angry', label: '😠 דורש את הכסף' }
              ]}
            />
          </Field>
          <Field label="הערות" full>
            <textarea
              rows={3}
              className={`${inputCls} h-auto py-2.5 resize-none`}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="פרטים נוספים (לא חובה)"
            />
          </Field>
        </form>
      </Drawer>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 ps-2.5 pe-1 rounded-full bg-white border border-line text-ink font-semibold">
      {label}
      <button type="button" onClick={onClear} aria-label={`הסרת סינון ${label}`} className="w-4 h-4 grid place-items-center rounded-full hover:bg-panel cursor-pointer">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
