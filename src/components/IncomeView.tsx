import React, { useState } from 'react';
import { IncomeEntry, IncomeSource } from '../types';
import { Plus, Trash2, Edit2, Check, X, Coins } from 'lucide-react';

interface IncomeViewProps {
  incomeEntries: IncomeEntry[];
  activeMonthId: string;
  onSaveIncome: (income: Omit<IncomeEntry, 'id'> & { id?: string }) => Promise<void>;
  onDeleteIncome: (id: string) => Promise<void>;
}

const SOURCES: IncomeSource[] = ['מקסימוס', 'UPS', 'מזומן', 'העברה בנקאית', 'משולם / GROW'];

export default function IncomeView({
  incomeEntries,
  activeMonthId,
  onSaveIncome,
  onDeleteIncome
}: IncomeViewProps) {
  // New income state
  const [newSource, setNewSource] = useState<IncomeSource>('מקסימוס');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState('');

  // Edit income state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<IncomeSource>('מקסימוס');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount) return;

    const dateToSave = newDate || new Date().toISOString().split('T')[0];

    await onSaveIncome({
      month_id: activeMonthId,
      source: newSource,
      amount: Number(newAmount) || 0,
      channel: 'חודשי', // Income is tracked monthly (no weekly split)
      date: dateToSave
    });

    setNewAmount('');
    setNewDate('');
  };

  const startEdit = (entry: IncomeEntry) => {
    setEditingId(entry.id);
    setEditSource(entry.source);
    setEditAmount(String(entry.amount));
    setEditDate(entry.date);
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (id: string) => {
    await onSaveIncome({
      id,
      month_id: activeMonthId,
      source: editSource,
      amount: Number(editAmount) || 0,
      channel: 'חודשי',
      date: editDate
    });
    setEditingId(null);
  };

  const totalIncome = incomeEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const sourceTotal = (src: IncomeSource) =>
    incomeEntries.filter((i) => i.source === src).reduce((a, c) => a + (Number(c.amount) || 0), 0);

  const fmtCurrency = (n: number) =>
    n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

  const getSourceBadgeColor = (source: IncomeSource) => {
    switch (source) {
      case 'מקסימוס': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'UPS': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'מזומן': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'העברה בנקאית': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'משולם / GROW': return 'bg-purple-50 text-purple-700 border border-purple-200';
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white shadow-card p-6 rounded-[1.6rem]">
        <h2 className="text-xl font-bold text-ink">רישום ומעקב הכנסות</h2>
        <p className="text-sm text-slate-500 mt-1">
          ניהול כל שערי ההכנסה של הסטודיו לפי מקורות — מסתכם באופן חודשי
        </p>
      </div>

      {/* Per-source summary blocks */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white shadow-card border border-emerald-200 rounded-[1.6rem] p-4">
          <span className="text-xs text-slate-500 font-medium block mb-1">סה״כ הכנסות החודש</span>
          <span className="text-2xl font-black font-mono text-emerald-600">{fmtCurrency(totalIncome)}</span>
        </div>
        {SOURCES.map((src) => (
          <div key={src} className="bg-white shadow-card rounded-[1.6rem] p-4">
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold mb-1.5 ${getSourceBadgeColor(src)}`}>
              {src}
            </span>
            <span className="text-lg font-black font-mono text-ink block">{fmtCurrency(sourceTotal(src))}</span>
          </div>
        ))}
      </div>

      {/* Entries Table */}
      <div className="bg-white shadow-card rounded-[1.6rem] overflow-hidden ">
        <div className="p-4 bg-slate-50 border-b border-line flex items-center gap-2">
          <Coins className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-bold text-ink">פירוט הכנסות החודש</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-line text-xs text-slate-500 bg-slate-50/60">
                <th className="p-4 font-semibold w-1/5">תאריך</th>
                <th className="p-4 font-semibold w-1/3">מקור הכנסה</th>
                <th className="p-4 font-semibold w-1/4">סכום</th>
                <th className="p-4 font-semibold text-center w-[15%]">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm text-ink-2">
              {incomeEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    טרם הוזנו רשומות הכנסה לחודש זה.
                  </td>
                </tr>
              ) : (
                incomeEntries.map((curr) => {
                  const isEditing = editingId === curr.id;
                  return (
                    <tr
                      key={curr.id}
                      className={`hover:bg-slate-50 transition-colors duration-200 ${isEditing ? 'bg-slate-50' : ''}`}
                    >
                      {/* Date */}
                      <td className="p-4 font-mono text-slate-500">
                        {isEditing ? (
                          <input
                            id={`edit-inc-date-${curr.id}`}
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-xs text-ink outline-none font-mono"
                          />
                        ) : (
                          <span>{formatDateString(curr.date)}</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="p-4">
                        {isEditing ? (
                          <select
                            id={`edit-inc-source-${curr.id}`}
                            value={editSource}
                            onChange={(e) => setEditSource(e.target.value as IncomeSource)}
                            className="bg-white border border-line rounded px-2 py-1.5 text-sm text-ink focus:border-navy outline-none"
                          >
                            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-1.5 rounded-lg text-xs font-bold leading-none ${getSourceBadgeColor(curr.source)}`}>
                            {curr.source}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-4 font-mono text-emerald-600 font-bold">
                        {isEditing ? (
                          <input
                            id={`edit-inc-amount-${curr.id}`}
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="bg-white border border-line rounded px-2 py-1.5 text-sm text-ink outline-none font-mono focus:border-navy"
                          />
                        ) : (
                          <span>+{Number(curr.amount).toLocaleString()} ₪</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(curr.id)} className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition-colors">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={cancelEdit} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(curr)} className="p-1.5 hover:bg-slate-100 hover:text-navy text-slate-500 rounded transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => onDeleteIncome(curr.id)} className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded transition-colors">
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

      {/* Add New Entry Form */}
      <div className="bg-white shadow-card p-6 rounded-[1.6rem]">
        <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-600" />
          רישום הכנסה חדשה
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">ערוץ / מקור הכנסה *</label>
            <select
              id="new-inc-source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value as IncomeSource)}
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-3 py-2.5 text-sm text-ink focus:border-navy"
            >
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">סכום בשקלים (₪) *</label>
            <input
              id="new-inc-amount"
              type="number"
              required
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink font-mono focus:border-navy"
            />
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-slate-500 font-medium">תאריך הקבלה</label>
              <input
                id="new-inc-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-slate-50 border border-line outline-none rounded-xl px-3 py-2.5 text-sm text-ink font-mono focus:border-navy"
              />
            </div>

            <button
              id="add-inc-btn"
              type="submit"
              className="bg-navy hover:bg-navy-2 text-white font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-navy/15"
              title="הוסף הכנסה"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
