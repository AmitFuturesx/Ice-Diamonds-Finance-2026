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

  const visibleExpenses =
    statusFilter === 'all' ? expenses : expenses.filter((e) => e.status === statusFilter);

  const fmtCurrency = (n: number) =>
    n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' });

  const getStatusBadgeStyles = (status: PaymentStatus) => {
    switch (status) {
      case 'שולם':
        return 'bg-green-950/40 text-green-400 border border-green-500/30';
      case 'שולם חלקית':
        return 'bg-amber-950/40 text-amber-400 border border-amber-500/30';
      case 'לא שולם':
        return 'bg-red-950/40 text-red-400 border border-red-500/30';
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
      activeClasses: 'border-[#22c55e] bg-[#22c55e]/10',
      accentText: 'text-[#22c55e]'
    },
    {
      key: 'שולם',
      label: 'שולם',
      amount: paidTotal,
      count: expenses.filter((e) => e.status === 'שולם').length,
      activeClasses: 'border-green-500 bg-green-500/10',
      accentText: 'text-green-400'
    },
    {
      key: 'שולם חלקית',
      label: 'שולם חלקית',
      amount: partialTotal,
      count: expenses.filter((e) => e.status === 'שולם חלקית').length,
      activeClasses: 'border-amber-500 bg-amber-500/10',
      accentText: 'text-amber-400'
    },
    {
      key: 'לא שולם',
      label: 'נותר לשלם',
      amount: remainingTotal,
      count: expenses.filter((e) => e.status === 'לא שולם').length,
      activeClasses: 'border-red-500 bg-red-500/10',
      accentText: 'text-red-400'
    }
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-[#121212] border border-zinc-800 p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white">הוצאות קבועות</h2>
        <p className="text-sm text-zinc-500 mt-1">
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
              className={`text-right p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                isActive ? card.activeClasses : 'border-zinc-800 bg-[#121212] hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 font-medium">{card.label}</span>
                <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded-full">
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
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>מסונן לפי: <span className="font-semibold text-white">{summaryCards.find((c) => c.key === statusFilter)?.label}</span></span>
          <button
            id="fixed-clear-filter-btn"
            onClick={() => setStatusFilter('all')}
            className="text-[#22c55e] hover:underline"
          >
            הצג הכל
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-900/30 border-b border-zinc-800/80 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-300 tracking-wider">טבלת הוצאות קבועות</span>
          <span className="text-xs text-zinc-500">לחץ על תג הסטטוס או יום החיוב כדי לשנותם</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/10">
                <th className="p-4 font-semibold text-center w-[15%]">יום חיוב</th>
                <th className="p-4 font-semibold w-1/4">שם ההוצאה</th>
                <th className="p-4 font-semibold w-1/6">סכום</th>
                <th className="p-4 font-semibold w-1/4">הערות ופירוט</th>
                <th className="p-4 font-semibold text-center w-[15%]">סטטוס תשלום</th>
                <th className="p-4 font-semibold text-center w-[10%]">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {visibleExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-600">
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
                      className={`hover:bg-zinc-900/35 transition-colors duration-200 ${
                        isEditing ? 'bg-zinc-900/60' : ''
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
                              ? 'bg-zinc-800/60 text-zinc-400 border border-zinc-700'
                              : 'bg-sky-950/40 text-sky-300 border border-sky-500/30'
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
                            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none focus:border-green-500"
                          />
                        ) : (
                          <span className="font-medium text-white">{exp.name}</span>
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
                            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none font-mono focus:border-green-500"
                          />
                        ) : (
                          <span className="font-semibold text-zinc-200">
                            {fmtCurrency(Number(exp.amount))}
                          </span>
                        )}
                      </td>

                      {/* Notes Col */}
                      <td className="p-4 text-zinc-400">
                        {isEditing ? (
                          <input
                            id={`edit-notes-${exp.id}`}
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="הערות..."
                            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none focus:border-green-500"
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
                            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-green-500"
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
                                className="p-1.5 hover:bg-green-950/40 text-green-400 rounded transition-colors"
                                title="שמור שינויים"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                id={`cancel-btn-${exp.id}`}
                                onClick={cancelEdit}
                                className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded transition-colors"
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
                                className="p-1.5 hover:bg-zinc-800 hover:text-[#22c55e] text-zinc-500 rounded transition-colors"
                                title="ערוך שורה"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`delete-btn-${exp.id}`}
                                onClick={() => onDeleteExpense(exp.id)}
                                className="p-1.5 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 rounded transition-colors"
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
      <div className="bg-[#121212] border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#22c55e]" />
          הוספת שורה חדשה להוצאות הקבועות
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Billing Day selector */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">יום חיוב *</label>
            <div className="flex gap-1.5">
              {BILLING_OPTIONS.map((day) => (
                <button
                  key={String(day)}
                  type="button"
                  id={`new-fixed-billing-day-${day}`}
                  onClick={() => setNewBillingDay(day)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                    newBillingDay === day
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {day === 'unknown' ? 'לא ידוע' : day}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">שם ההוצאה *</label>
            <input
              id="new-fixed-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="לדוג׳ שכירות משרד, ביטוח חודשי..."
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">סכום בשקלים (₪) *</label>
            <input
              id="new-fixed-amount"
              type="number"
              required
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">הערות / פירוט</label>
            <input
              id="new-fixed-notes"
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="מידע נוסף..."
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-zinc-400 font-medium">סטטוס ראשוני</label>
              <select
                id="new-fixed-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as PaymentStatus)}
                className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-3 py-2.5 text-sm text-white focus:border-green-500"
              >
                <option value="לא שולם">לא שולם</option>
                <option value="שולם חלקית">שולם חלקית</option>
                <option value="שולם">שולם</option>
              </select>
            </div>

            <button
              id="add-fixed-btn"
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-black font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-green-500/10"
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
