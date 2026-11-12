/* Debts & loans — one card per loan with a payoff ring, plus filters, search and a side drawer. */
import { FormEvent, useState } from 'react';
import { Debt, PaymentStatus } from '../types';
import { TableSearch, useTable } from '../components/TableControls';
import { ils, useCountUp } from '../lib/hooks';
import {
  Card,
  StatTile,
  Segmented,
  StatusPill,
  MoodChip,
  RowMenu,
  Drawer,
  Field,
  ChoiceChips,
  Button,
  Empty,
  Ring,
  inputCls,
  TONES,
  nextStatus,
  nextMood
} from '../ui/kit';
import { Landmark, CheckCircle2, CircleDashed, Hourglass, Plus, Pencil, Trash2, Check, SearchX, Flag, Wallet } from 'lucide-react';

type Notify = (m: string, o?: { tone?: 'success' | 'error' | 'info'; duration?: number; action?: { label: string; run: () => void } }) => void;

interface Props {
  debts: Debt[];
  activeMonthId: string;
  onSaveDebt: (d: Omit<Debt, 'id'> & { id?: string }) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
  notify?: Notify;
}

type StatusFilter = 'all' | PaymentStatus;
const UNSET = 'לא סומן';

const statusOf = (d: Debt): PaymentStatus => d.status || 'לא שולם';
/** Day of month from the stored text ("10", "2026-04-15", "לא סומן") */
const dayNum = (s?: string): number | null => {
  if (!s || s === UNSET) return null;
  const parts = s.split('-');
  const n = parseInt(parts.length === 3 ? parts[2] : s, 10);
  return isNaN(n) ? null : n;
};
/** Payments still left AFTER this month's one */
const paymentsLeft = (d: Debt): number | null => {
  const pay = Number(d.monthly_payment) || 0;
  const bal = Number(d.current_balance) || 0;
  return pay > 0 ? Math.max(0, Math.ceil(bal / pay) - 1) : null;
};
const leftLabel = (n: number | null) =>
  n === null ? '' : n === 0 ? 'התשלום האחרון החודש' : n === 1 ? 'נותר תשלום 1' : `נותרו ${n} תשלומים`;
/** When will it be paid off, counting from the open month */
const payoffLabel = (n: number | null, year?: number, month?: number) => {
  if (n === null || !year || !month) return '';
  const d = new Date(year, month - 1 + n, 1);
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
};

export default function DebtsPage({ debts, activeMonthId, onSaveDebt, onDeleteDebt, notify, monthYear, monthNumber }: Props & { monthYear?: number; monthNumber?: number }) {
  const save = (d: Debt, patch: Partial<Debt>) => onSaveDebt({ ...d, ...patch });
  const markPaid = (d: Debt) => {
    const prev = statusOf(d);
    save(d, { status: 'שולם' });
    notify?.(`סומן כשולם: ${d.name}`, { tone: 'success', duration: 7000, action: { label: 'בטל', run: () => save(d, { status: prev }) } });
  };

  /* ---- totals ---- */
  const pay = (d: Debt) => Number(d.monthly_payment) || 0;
  const monthly = debts.reduce((a, d) => a + pay(d), 0);
  const sumBy = (s: PaymentStatus) => debts.filter((d) => statusOf(d) === s).reduce((a, d) => a + pay(d), 0);
  const countBy = (s: PaymentStatus) => debts.filter((d) => statusOf(d) === s).length;
  const balance = debts.reduce((a, d) => a + (Number(d.current_balance) || 0), 0);
  const original = debts.reduce((a, d) => a + (Number(d.original_amount) || 0), 0);
  const repaid = Math.max(0, original - balance);
  const repaidPct = original > 0 ? (repaid / original) * 100 : 0;
  const nextToClose = [...debts]
    .map((d) => ({ d, n: paymentsLeft(d) }))
    .filter((x) => x.n !== null && Number(x.d.current_balance) > 0)
    .sort((a, b) => (a.n as number) - (b.n as number))[0];
  const balanceAnim = useCountUp(balance, 1100, 120);

  /* ---- filter / search / sort ---- */
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<'balance' | 'payment' | 'left'>('balance');
  const filtered = debts.filter((d) => status === 'all' || statusOf(d) === status);
  const { view, query, setQuery } = useTable(filtered, (d) => d.name, {});
  const sorted = [...view].sort((a, b) =>
    sortBy === 'balance'
      ? (Number(b.current_balance) || 0) - (Number(a.current_balance) || 0)
      : sortBy === 'payment'
      ? pay(b) - pay(a)
      : (paymentsLeft(a) ?? 9999) - (paymentsLeft(b) ?? 9999)
  );

  /* ---- drawer ---- */
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', payment: '', balance: '', day: '', status: 'לא שולם' as PaymentStatus, mood: 'happy' });
  const [saving, setSaving] = useState(false);
  const openNew = () => {
    setForm({ name: '', payment: '', balance: '', day: '10', status: 'לא שולם', mood: 'happy' });
    setEditing('new');
  };
  const openEdit = (d: Debt) => {
    const n = dayNum(d.payment_date);
    setForm({
      name: d.name,
      payment: String(d.monthly_payment ?? ''),
      balance: String(d.current_balance ?? ''),
      day: n === null ? '' : String(n),
      status: statusOf(d),
      mood: d.mood || 'happy'
    });
    setEditing(d);
  };
  const valid = form.name.trim() && form.payment !== '' && form.balance !== '';
  const submit = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (!valid) return;
    setSaving(true);
    const bal = Number(form.balance) || 0;
    const base = {
      name: form.name.trim(),
      monthly_payment: Number(form.payment) || 0,
      current_balance: bal,
      payment_date: form.day ? String(form.day) : UNSET,
      status: form.status,
      mood: form.mood
    };
    try {
      if (editing === 'new') await onSaveDebt({ month_id: activeMonthId, original_amount: bal, ...base });
      else if (editing) await onSaveDebt({ ...editing, ...base }); // original_amount is kept as is
      notify?.(editing === 'new' ? `נוסף חוב: ${base.name}` : `נשמר: ${base.name}`, { tone: 'success' });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };
  const formLeft = (() => {
    const p = Number(form.payment) || 0;
    const b = Number(form.balance) || 0;
    return p > 0 ? Math.max(0, Math.ceil(b / p) - 1) : null;
  })();

  const menuFor = (d: Debt) => [
    { id: 'edit', label: 'עריכה', icon: Pencil, onClick: () => openEdit(d) },
    ...(statusOf(d) !== 'שולם' ? [{ id: 'paid', label: 'סמן כשולם החודש', icon: Check, onClick: () => markPaid(d) }] : []),
    { id: 'del', label: 'מחיקה', icon: Trash2, danger: true, onClick: () => onDeleteDebt(d.id) }
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* KPI tiles (by this month's installment) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <StatTile i={0} icon={Wallet} label="החזר חודשי כולל" value={monthly} tone="navy" active={status === 'all'} onClick={() => setStatus('all')} sub={`${debts.length} חובות פעילים`} />
        <StatTile i={1} icon={CheckCircle2} label="שולם החודש" value={sumBy('שולם')} tone="green" active={status === 'שולם'} onClick={() => setStatus('שולם')} sub={`${countBy('שולם')} תשלומים`} />
        <StatTile i={2} icon={CircleDashed} label="שולם חלקית" value={sumBy('שולם חלקית')} tone="amber" active={status === 'שולם חלקית'} onClick={() => setStatus('שולם חלקית')} sub={`${countBy('שולם חלקית')} תשלומים`} />
        <StatTile i={3} icon={Hourglass} label="נותר לשלם החודש" value={sumBy('לא שולם') + sumBy('שולם חלקית')} tone="red" active={status === 'לא שולם'} onClick={() => setStatus('לא שולם')} sub={`${countBy('לא שולם')} לא שולמו`} />
      </div>

      {/* Payoff overview — navy feature card */}
      <div
        className="rounded-[1.6rem] p-5 sm:p-7 text-white relative overflow-hidden shadow-[0_24px_50px_-24px_rgb(22_32_79_/_0.7)]"
        style={{ background: 'radial-gradient(30rem 16rem at 0% 0%, rgb(217 180 85 / 0.22), transparent 60%), linear-gradient(155deg, #2a377a 0%, #1b2660 52%, #16204f 100%)' }}
      >
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="text-xs text-white/65">יתרת חוב כוללת לפירעון</div>
            <b className="block num text-[34px] sm:text-[44px] font-black tracking-tight leading-none mt-2">{ils(balanceAnim)}</b>
            <div className="mt-5 max-w-xl">
              <div className="flex justify-between text-xs text-white/65 mb-1.5">
                <span>כמה כבר סילקנו מהקרן המקורית</span>
                <b className="text-gold num">{repaidPct.toFixed(1)}%</b>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-[#f0d58a] to-gold grow-x" style={{ width: `${repaidPct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-white/55 mt-1.5">
                <span>
                  סולק <b className="text-white/85 num">{ils(repaid)}</b>
                </span>
                <span>
                  קרן מקורית <b className="text-white/85 num">{ils(original)}</b>
                </span>
              </div>
            </div>
          </div>
          {nextToClose && (
            <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-4 lg:w-72">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <Flag className="w-3.5 h-3.5 text-gold" />
                החוב הבא שנסגר
              </div>
              <div className="font-bold mt-1.5 truncate">{nextToClose.d.name}</div>
              <div className="text-sm text-white/75 mt-0.5">
                {leftLabel(nextToClose.n)}
                {nextToClose.n ? ` · עד ${payoffLabel(nextToClose.n, monthYear, monthNumber)}` : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Segmented
          full
          label="סינון לפי סטטוס"
          value={status}
          onChange={setStatus}
          options={[
            { id: 'all', label: 'הכל', count: debts.length },
            { id: 'לא שולם', label: 'לא שולם', count: countBy('לא שולם') },
            { id: 'שולם חלקית', label: 'חלקית', count: countBy('שולם חלקית') },
            { id: 'שולם', label: 'שולם', count: countBy('שולם') }
          ]}
        />
        <div className="flex items-center gap-2 lg:ms-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="מיון"
            className="h-10 bg-white border border-line rounded-xl px-3 text-sm font-semibold text-ink outline-none focus:border-navy cursor-pointer shrink-0"
          >
            <option value="balance">לפי יתרה</option>
            <option value="payment">לפי החזר חודשי</option>
            <option value="left">הכי קרוב לסגירה</option>
          </select>
          <TableSearch value={query} onChange={setQuery} placeholder="חיפוש חוב" count={view.length} total={filtered.length} />
          <Button icon={Plus} onClick={openNew} className="shrink-0">
            <span className="hidden sm:inline">חוב חדש</span>
          </Button>
        </div>
      </div>

      {/* Debt cards */}
      {debts.length === 0 ? (
        <Card>
          <Empty icon={Landmark} title="אין חובות פעילים בחודש הזה" text="הלוואות, ליסינג ומימון — כל מה שמחזירים בתשלומים.">
            <Button icon={Plus} onClick={openNew}>
              חוב חדש
            </Button>
          </Empty>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <Empty icon={SearchX} title="אין תוצאות" text="אף חוב לא מתאים לסינון.">
            <Button
              variant="soft"
              onClick={() => {
                setStatus('all');
                setQuery('');
              }}
            >
              ניקוי סינון
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5">
          {sorted.map((d) => {
            const bal = Number(d.current_balance) || 0;
            const orig = Number(d.original_amount) || 0;
            const pct = orig > 0 ? Math.max(0, Math.min(100, ((orig - bal) / orig) * 100)) : 0;
            const n = paymentsLeft(d);
            const day = dayNum(d.payment_date);
            const st = statusOf(d);
            return (
              <div key={d.id} className="bg-white rounded-[1.6rem] shadow-card p-5 flex flex-col gap-4 cursor-pointer hover:-translate-y-0.5 transition-transform">
                <div className="flex items-start gap-3" onClick={() => openEdit(d)}>
                  <Ring value={pct} size={64} stroke={7} color={pct >= 100 ? TONES.green : TONES.navy}>
                    <span className="text-[12px] font-extrabold text-ink num">{pct.toFixed(0)}%</span>
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink truncate">{d.name}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">{day === null ? 'יום חיוב לא ידוע' : `חיוב ב־${day} לחודש`}</div>
                    {n !== null && (
                      <span
                        className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          n === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-[#eef0f8] text-navy'
                        }`}
                      >
                        {leftLabel(n)}
                      </span>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="-mt-1 -me-1">
                    <RowMenu items={menuFor(d)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2" onClick={() => openEdit(d)}>
                  <div className="rounded-xl bg-panel px-3 py-2.5">
                    <div className="text-[11px] text-muted">החזר חודשי</div>
                    <b className="text-ink num">{ils(pay(d))}</b>
                  </div>
                  <div className="rounded-xl bg-panel px-3 py-2.5">
                    <div className="text-[11px] text-muted">יתרה</div>
                    <b className="text-ink num">{ils(bal)}</b>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line -mx-5 px-5 pt-3.5">
                  <StatusPill status={st} onClick={() => save(d, { status: nextStatus(st) })} />
                  <MoodChip mood={d.mood} onClick={() => save(d, { mood: nextMood(d.mood || 'happy') })} />
                  {n !== null && n > 0 && monthYear && (
                    <span className="ms-auto text-[11px] text-muted whitespace-nowrap">עד {payoffLabel(n, monthYear, monthNumber)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit drawer */}
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        icon={Landmark}
        title={editing === 'new' ? 'חוב חדש' : 'עריכת חוב'}
        sub={editing && editing !== 'new' ? editing.name : 'הלוואה, ליסינג או מימון'}
        footer={
          <>
            <Button type="submit" form="debt-form" disabled={saving || !valid} className="flex-1">
              {saving ? 'שומר...' : editing === 'new' ? 'הוספה' : 'שמירת שינויים'}
            </Button>
            {editing && editing !== 'new' && (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  const id = editing.id;
                  setEditing(null);
                  onDeleteDebt(id);
                }}
              >
                מחיקה
              </Button>
            )}
          </>
        }
      >
        <form id="debt-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="גורם מלווה / ספק *" full>
            <input autoFocus className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="לדוגמה: הלוואה בנק לאומי" />
          </Field>
          <Field label="החזר חודשי (₪) *">
            <input type="number" inputMode="decimal" className={`${inputCls} num font-bold`} value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })} placeholder="0" />
          </Field>
          <Field label="יתרת חוב נוכחית (₪) *">
            <input type="number" inputMode="decimal" className={`${inputCls} num font-bold`} value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="0" />
          </Field>
          {formLeft !== null && (
            <div className="sm:col-span-2 rounded-xl bg-[#eef0f8] text-navy text-sm font-semibold px-3.5 py-2.5">
              {leftLabel(formLeft)}
              {formLeft > 0 && monthYear ? ` · ייסגר ב${payoffLabel(formLeft, monthYear, monthNumber)}` : ''}
            </div>
          )}
          <Field label="יום חיוב בחודש" full hint="אפשר לבחור מהיר או להקליד יום אחר (1–31)">
            <div className="flex flex-wrap gap-1.5 items-center">
              <ChoiceChips
                value={['10', '15', '19', ''].includes(form.day) ? form.day : '__other'}
                onChange={(v) => v !== '__other' && setForm({ ...form, day: v })}
                options={[
                  { id: '10', label: '10' },
                  { id: '15', label: '15' },
                  { id: '19', label: '19' },
                  { id: '', label: 'לא ידוע' }
                ]}
              />
              <input
                type="number"
                min={1}
                max={31}
                aria-label="יום אחר"
                placeholder="אחר"
                className={`${inputCls} !w-20 text-center num`}
                value={['10', '15', '19', ''].includes(form.day) ? '' : form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
              />
            </div>
          </Field>
          <Field label="סטטוס התשלום החודש" full>
            <ChoiceChips
              value={form.status}
              onChange={(s) => setForm({ ...form, status: s })}
              options={[
                { id: 'לא שולם', label: 'לא שולם' },
                { id: 'שולם חלקית', label: 'שולם חלקית' },
                { id: 'שולם', label: 'שולם' }
              ]}
            />
          </Field>
          <Field label="כמה המלווה לחוץ" full>
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
        </form>
      </Drawer>
    </div>
  );
}
