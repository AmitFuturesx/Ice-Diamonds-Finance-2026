import React, { useState } from 'react';
import { FixedExpense, PaymentStatus } from '../types';
import { Plus, Trash2, Edit2, Check, X, CalendarClock } from 'lucide-react';

interface FixedExpensesViewProps {
  expenses: FixedExpense[];
  activeMonthId: string;
  onSaveExpense: (expense: Omit<FixedExpense, 'id'> & { id?: string }) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

// A billing day is a day-of-month, or 'unknown' when not set
type BillingDay = number | 'unknown';
const BILLING_DAYS = [10, 15, 19];
const BILLING_OPTIONS: BillingDay[] = [10, 15, 19, 'unknown'];

type StatusFilter = 'all' | PaymentStatus;

export default function FixedExpensesView({
  expenses,
  activeMonthId,
  onSaveExpense,
  onDeleteExpense
}: FixedExpensesViewProps) {
  // New expense form state
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStatus, setNewStatus] = useState<PaymentStatus>('לא שולם');
  const [newBillingDay, setNewBillingDay] = useState<BillingDay>(10);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('לא שולם');

  // Which status the table is filtered to (via the clickable summary blocks)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // Which billing-day popup is open (null = closed)
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Vendor patience mood config
  const MOODS: Record<string, { emoji: string; label: string; cls: string }> = {
    happy: { emoji: '😊', label: 'רגוע', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    neutral: { emoji: '😐', label: 'העיר על זה', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    angry: { emoji: '😠', label: 'דורש את הכסף', cls: 'bg-rose-50 text-rose-600 border-rose-200' }
  };
  const nextMood = (m: string) => (m === 'happy' ? 'neutral' : m === 'neutral' ? 'angry' : 'happy');

  // Convert a billing-day value to the stored text ("" for unknown)
  const billingDayToStored = (day: BillingDay) => (day === 'unknown' ? '' : String(day));

  // Read the billing day from a stored value; empty => 'unknown'
  const getDay = (stored?: string): BillingDay => {
    if (!stored) return 'unknown';
    const d = parseInt(stored, 10);
    return isNaN(d) ? 'unknown' : d;
  };

  // Snap a stored day to one of the allowed options
  const nearestBillingDay = (day: BillingDay): BillingDay => {
    if (day === 'unknown') return 'unknown';
    if (BILLING_DAYS.includes(day)) return day;
    return BILLING_DAYS.reduce((prev, curr) =>
      Math.abs(curr - day) < Math.abs(prev - day) ? curr : prev
    );
  };

  const billingDayLabel = (day: BillingDay) =>
    day === 'unknown' ? 'לא ידוע' : `${day} לחודש`;

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;

    await onSaveExpense({
      month_id: activeMonthId,
      name: newName,
      amount: Number(newAmount) || 0,
      notes: newNotes,
      status: newStatus,
      payment_date: billingDayToStored(newBillingDay)
    });

    setNewName('');
    setNewAmount('');
    setNewNotes('');
    setNewStatus('לא שולם');
    setNewBillingDay(10);
  };

  const startEdit = (exp: FixedExpense) => {
    setEditingId(exp.id);
    setEditName(exp.name);
    setEditAmount(String(exp.amount));
    setEditNotes(exp.notes);
    setEditStatus(exp.status);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string, currentPaymentDate?: string) => {
    await onSaveExpense({
      id,
      month_id: activeMonthId,
      name: editName,
      amount: Number(editAmount) || 0,
      notes: editNotes,
      status: editStatus,
      payment_date: currentPaymentDate
    });
    setEditingId(null);
  };

  // Clickable 3-state cycle toggle: שולם -> שולם חלקית -> לא שולם -> שולם
  const handleCycleStatus = async (item: FixedExpense) => {
    const nextStatusMap: Record<PaymentStatus, PaymentStatus> = {
      'שולם': 'שולם חלקית',
      'שולם חלקית': 'לא שולם',
      'לא שולם': 'שולם'
    };
    await onSaveExpense({ ...item, status: nextStatusMap[item.status] });
  };

  // Clickable billing-day cycle: 10 -> 15 -> 19 -> לא ידוע -> 10
  const handleCycleBillingDay = async (item: FixedExpense) => {
    const currentDay = nearestBillingDay(getDay(item.payment_date));
    const idx = BILLING_OPTIONS.indexOf(currentDay);
    const nextDay = BILLING_OPTIONS[(idx + 1) % BILLING_OPTIONS.length];
    await onSaveExpense({ ...item, payment_date: billingDayToStored(nextDay) });
  };

  // Totals per status
  const sumFor = (status: PaymentStatus) =>
    expenses.filter((e) => e.status === status).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const paidTotal = sumFor('שולם');
  const partialTotal = sumFor('שולם חלקית');
  const unpaidTotal = sumFor('לא שולם');
  const remainingTotal = partialTotal + unpaidTotal;
  const totalFixed = paidTotal + partialTotal + unpaidTotal;

  // Amount to pay per billing day (fixed expenses only) + remaining (unpaid)
  const dayBuckets: Record<string, number> = { '10': 0, '15': 0, '19': 0, unknown: 0 };
  const dayRemaining: Record<string, number> = { '10': 0, '15': 0, '19': 0, unknown: 0 };
  expenses.forEach((e) => {
    const d = nearestBillingDay(getDay(e.payment_date));
    const key = d === 'unknown' ? 'unknown' : String(d);
    const amt = Number(e.amount) || 0;
    dayBuckets[key] += amt;
    if (e.status !== 'שולם') dayRemaining[key] += amt;
  });
  const billingDayCards = [
    { key: '10', label: '10 לחודש', amount: dayBuckets['10'], remaining: dayRemaining['10'] },
    { key: '15', label: '15 לחודש', amount: dayBuckets['15'], remaining: dayRemaining['15'] },
    { key: '19', label: '19 לחודש', amount: dayBuckets['19'], remaining: dayRemaining['19'] },
    { key: 'unknown', label: 'לא ידוע מתי', amount: dayBuckets['unknown'], remaining: dayRemaining['unknown'] }
  ];

  // Unpaid items for the open billing-day popup
  const dayKeyOf = (e: FixedExpense) => {
    const d = nearestBillingDay(getDay(e.payment_date));
    return d === 'unknown' ? 'unknown' : String(d);
  };
  const openDayItems = openDay
    ? expenses.filter((e) => dayKeyOf(e) === openDay && e.status !== 'שולם')
    : [];
  const openDayLabel = billingDayCards.find((c) => c.key === openDay)?.label || '';
  const openDayRemaining = openDayItems.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const cycleMood = (e: FixedExpense) => onSaveExpense({ ...e, mood: nextMood(e.mood || 'happy') });

  const visibleExpenses =
    statusFilter === 'all' ? expenses : expenses.filter((e) => e.status === statusFilter);

  const fmtCurrency = (n: number) =>
    n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' });

  const getStatusBadgeStyles = (status: PaymentStatus) => {
    switch (status) {
      case 'שולם':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
      case 'שולם חלקית':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'לא שולם':
        return 'bg-rose-50 text-rose-600 border border-rose-200';
    }
  };

  const summaryCards: {
    key: StatusFilter;
    label: string;
    amount: number;
    count: number;
    activeClasses: string;
    accentText: string;
  }[] = [
    {
      key: 'all',
      label: 'סה״כ הכל',
      amount: totalFixed,
      count: expenses.length,
      activeClasses: 'border-emerald-400 bg-emerald-50',
      accentText: 'text-emerald-600'
    },
    {
      key: 'שולם',
      label: 'שולם',
      amount: paidTotal,
      count: expenses.filter((e) => e.status === 'שולם').length,
      activeClasses: 'border-emerald-500 bg-emerald-50',
      accentText: 'text-emerald-600'
    },
    {
      key: 'שולם חלקית',
      label: 'שולם חלקית',
      amount: partialTotal,
      count: expenses.filter((e) => e.status === 'שולם חלקית').length,
      activeClasses: 'border-amber-400 bg-amber-50',
      accentText: 'text-amber-700'
    },
    {
      key: 'לא שולם',
      label: 'נותר לשלם',
      amount: remainingTotal,
      count: expenses.filter((e) => e.status === 'לא שולם').length,
      activeClasses: 'border-rose-400 bg-rose-50',
      accentText: 'text-rose-600'
    }
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white shadow-card p-6 rounded-[1.6rem]">
        <h2 className="text-xl font-bold text-ink">הוצאות קבועות</h2>
        <p className="text-sm text-slate-500 mt-1">
          מעקב אחר תשלומים גבוהים בעלי מחזור קבוע (שכירות, ארנונה, תקשורת וכדומה)
        </p>
      </div>

      {/* Clickable status summary blocks (act as filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => {
          const isActive = statusFilter === card.key;
          return (
            <button
              key={card.key}
              id={`fixed-filter-card-${card.key}`}
              onClick={() => setStatusFilter(card.key)}
              className={`text-right p-4 rounded-[1.6rem] border transition-all duration-200 cursor-pointer hover:scale-[1.02] ${ isActive ? card.activeClasses : 'border-line bg-white shadow-card hover:border-slate-300' }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">{card.label}</span>
                <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-full">
                  {card.count}
                </span>
              </div>
              <span className={`text-xl font-black font-mono ${card.accentText}`}>
                {fmtCurrency(card.amount)}
              </span>
            </button>
          );
        })}
      </div>

      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>מסונן לפי: <span className="font-semibold text-ink">{summaryCards.find((c) => c.key === statusFilter)?.label}</span></span>
          <button
            id="fixed-clear-filter-btn"
            onClick={() => setStatusFilter('all')}
            className="text-emerald-600 hover:underline"
          >
            הצג הכל
          </button>
        </div>
      )}

      {/* Payment schedule by billing day (fixed only) */}
      <div className="bg-white shadow-card rounded-[1.6rem] p-5">
        <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-sky-700" />
          כמה לשלם בכל תאריך — הוצאות קבועות
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {billingDayCards.map((card) => (
            <button
              key={card.key}
              onClick={() => setOpenDay(card.key)}
              className={`text-right p-3.5 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                card.key === 'unknown' ? 'bg-slate-100 border-slate-300 hover:border-slate-400' : 'bg-sky-50 border-sky-200 hover:border-sky-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">{card.label}</span>
                <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">לחץ</span>
              </div>
              <span className={`text-lg font-black font-mono block ${card.key === 'unknown' ? 'text-ink-2' : 'text-sky-700'}`}>
                {card.amount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
              </span>
              <div className="mt-1.5 pt-1.5 border-t border-line flex items-center justify-between">
                <span className="text-[10px] text-slate-500">נותר</span>
                <span className={`text-xs font-bold font-mono ${card.remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {card.remaining.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Billing-day popup: who still needs to be paid (fixed) + patience level */}
      {openDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setOpenDay(null)}></div>
          <div className="relative bg-white shadow-card rounded-[1.6rem] w-full max-w-lg max-h-[85vh] flex flex-col ">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-sky-700" />
                  למי נותר לשלם — {openDayLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  הוצאות קבועות · סה״כ נותר: <span className="text-rose-600 font-bold font-mono">
                    {openDayRemaining.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
                  </span>
                </p>
              </div>
              <button onClick={() => setOpenDay(null)} className="p-2 text-slate-500 hover:text-ink hover:bg-slate-100 rounded-full transition-colors" title="סגור">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2.5">
              {openDayItems.length === 0 ? (
                <div className="py-10 text-center text-emerald-600 text-sm font-semibold">🎉 הכול שולם לתאריך הזה!</div>
              ) : (
                openDayItems.map((e) => {
                  const mood = MOODS[e.mood || 'happy'] || MOODS.happy;
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-line rounded-xl px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{e.name}</div>
                        <div className="text-xs text-slate-500">{e.status === 'שולם חלקית' ? 'שולם חלקית' : 'לא שולם'}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {(Number(e.amount) || 0).toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
                        </span>
                        <button
                          onClick={() => cycleMood(e)}
                          title="לחץ לשינוי רמת הכעס"
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:scale-105 ${mood.cls}`}
                        >
                          <span className="text-base leading-none">{mood.emoji}</span>
                          <span className="hidden sm:inline">{mood.label}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-5 py-3 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>😊 רגוע</span><span>😐 העיר על זה</span><span>😠 דורש את הכסף</span>
              <span className="text-slate-400">· לחץ על הפרצוף לעדכון</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white shadow-card rounded-[1.6rem] overflow-hidden ">
        <div className="p-4 bg-slate-50 border-b border-line flex justify-between items-center">
          <span className="text-xs font-bold text-ink-2 tracking-wider">טבלת הוצאות קבועות</span>
          <span className="text-xs text-slate-500">לחץ על תג הסטטוס או יום החיוב כדי לשנותם</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-line text-xs text-slate-500 bg-slate-50/60">
                <th className="p-4 font-semibold text-center w-[15%]">יום חיוב</th>
                <th className="p-4 font-semibold w-1/4">שם ההוצאה</th>
                <th className="p-4 font-semibold w-1/6">סכום</th>
                <th className="p-4 font-semibold w-1/4">הערות ופירוט</th>
                <th className="p-4 font-semibold text-center w-[15%]">סטטוס תשלום</th>
                <th className="p-4 font-semibold text-center w-[10%]">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm text-ink-2">
              {visibleExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {expenses.length === 0
                      ? 'אין הוצאות קבועות רשומות לחודש הנבחר.'
                      : 'אין הוצאות בסטטוס הנבחר.'}
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((exp) => {
                  const isEditing = editingId === exp.id;
                  const billingDay = nearestBillingDay(getDay(exp.payment_date));

                  return (
                    <tr
                      key={exp.id}
                      className={`hover:bg-slate-50 transition-colors duration-200 ${
                        isEditing ? 'bg-slate-50' : ''
                      }`}
                    >
                      {/* Billing Day Col (clickable cycle) */}
                      <td className="p-4 text-center">
                        <button
                          id={`fixed-billing-day-${exp.id}`}
                          onClick={() => handleCycleBillingDay(exp)}
                          title="לחץ לשינוי יום החיוב"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95 ${
                            billingDay === 'unknown'
                              ? 'bg-slate-100 text-slate-500 border border-slate-300'
                              : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          {billingDayLabel(billingDay)}
                        </button>
                      </td>

                      {/* Name Col */}
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            id={`edit-name-${exp.id}`}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-full outline-none focus:border-navy"
                          />
                        ) : (
                          <span className="font-medium text-ink">{exp.name}</span>
                        )}
                      </td>

                      {/* Amount Col */}
                      <td className="p-4 font-mono">
                        {isEditing ? (
                          <input
                            id={`edit-amount-${exp.id}`}
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-full outline-none font-mono focus:border-navy"
                          />
                        ) : (
                          <span className="font-semibold text-ink">
                            {fmtCurrency(Number(exp.amount))}
                          </span>
                        )}
                      </td>

                      {/* Notes Col */}
                      <td className="p-4 text-slate-500">
                        {isEditing ? (
                          <input
                            id={`edit-notes-${exp.id}`}
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="הערות..."
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-full outline-none focus:border-navy"
                          />
                        ) : (
                          <span>{exp.notes || '—'}</span>
                        )}
                      </td>

                      {/* Status Col */}
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <select
                            id={`edit-status-${exp.id}`}
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as PaymentStatus)}
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-xs text-ink outline-none focus:border-navy"
                          >
                            <option value="שולם">שולם</option>
                            <option value="שולם חלקית">שולם חלקית</option>
                            <option value="לא שולם">לא שולם</option>
                          </select>
                        ) : (
                          <button
                            id={`status-badge-${exp.id}`}
                            onClick={() => handleCycleStatus(exp)}
                            title="לחץ לשינוי מהיר"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95 ${getStatusBadgeStyles(exp.status)}`}
                          >
                            {exp.status}
                          </button>
                        )}
                      </td>

                      {/* Actions Col */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                id={`save-btn-${exp.id}`}
                                onClick={() => handleSaveEdit(exp.id, exp.payment_date)}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition-colors"
                                title="שמור שינויים"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                id={`cancel-btn-${exp.id}`}
                                onClick={cancelEdit}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-colors"
                                title="בטל"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                id={`edit-trigger-${exp.id}`}
                                onClick={() => startEdit(exp)}
                                className="p-1.5 hover:bg-slate-100 hover:text-navy text-slate-500 rounded transition-colors"
                                title="ערוך שורה"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`delete-btn-${exp.id}`}
                                onClick={() => onDeleteExpense(exp.id)}
                                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded transition-colors"
                                title="מחק שורה"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Row Form Box */}
      <div className="bg-white shadow-card p-6 rounded-[1.6rem]">
        <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-600" />
          הוספת שורה חדשה להוצאות הקבועות
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Billing Day selector */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">יום חיוב *</label>
            <div className="flex gap-1.5">
              {BILLING_OPTIONS.map((day) => (
                <button
                  key={String(day)}
                  type="button"
                  id={`new-fixed-billing-day-${day}`}
                  onClick={() => setNewBillingDay(day)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                    newBillingDay === day
                      ? 'bg-sky-100 text-sky-700 border-sky-400'
                      : 'bg-slate-50 text-slate-500 border-line hover:border-slate-300'
                  }`}
                >
                  {day === 'unknown' ? 'לא ידוע' : day}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">שם ההוצאה *</label>
            <input
              id="new-fixed-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="לדוג׳ שכירות משרד, ביטוח חודשי..."
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink focus:border-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">סכום בשקלים (₪) *</label>
            <input
              id="new-fixed-amount"
              type="number"
              required
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink font-mono focus:border-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">הערות / פירוט</label>
            <input
              id="new-fixed-notes"
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="מידע נוסף..."
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink focus:border-navy"
            />
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-slate-500 font-medium">סטטוס ראשוני</label>
              <select
                id="new-fixed-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as PaymentStatus)}
                className="w-full bg-slate-50 border border-line outline-none rounded-xl px-3 py-2.5 text-sm text-ink focus:border-navy"
              >
                <option value="לא שולם">לא שולם</option>
                <option value="שולם חלקית">שולם חלקית</option>
                <option value="שולם">שולם</option>
              </select>
            </div>

            <button
              id="add-fixed-btn"
              type="submit"
              className="bg-navy hover:bg-navy-2 text-white font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-navy/15"
              title="הוסף שורה"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
