import React, { useState } from 'react';
import { IncomeEntry, IncomeSource } from '../types';
import { Plus, Trash2, Edit2, Check, X, Coins, DollarSign, CalendarCheck } from 'lucide-react';

interface IncomeViewProps {
  incomeEntries: IncomeEntry[];
  activeMonthId: string;
  onSaveIncome: (income: Omit<IncomeEntry, 'id'> & { id?: string }) => Promise<void>;
  onDeleteIncome: (id: string) => Promise<void>;
}

export default function IncomeView({
  incomeEntries,
  activeMonthId,
  onSaveIncome,
  onDeleteIncome
}: IncomeViewProps) {
  // New income state
  const [newSource, setNewSource] = useState<IncomeSource>('מקסימוס');
  const [newAmount, setNewAmount] = useState('');
  const [newChannel, setNewChannel] = useState('שבוע 1');
  const [newDate, setNewDate] = useState('');

  // Edit income state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<IncomeSource>('מקסימוס');
  const [editAmount, setEditAmount] = useState('');
  const [editChannel, setEditChannel] = useState('שבוע 1');
  const [editDate, setEditDate] = useState('');

  const sourcesList: IncomeSource[] = ['מקסימוס', 'UPS', 'מזומן', 'העברה בנקאית', 'קארדקום'];
  const channelsList = ['שבוע 1', 'שבוע 2', 'שבוע 3', 'שבוע 4'];

  // Matrix calculation
  // We want to construct a grid for Source x Week
  const getMatrixValue = (source: IncomeSource, channel: string) => {
    return incomeEntries
      .filter(i => i.source === source && i.channel === channel)
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount) return;

    const dateToSave = newDate || new Date().toISOString().split('T')[0];

    await onSaveIncome({
      month_id: activeMonthId,
      source: newSource,
      amount: Number(newAmount) || 0,
      channel: newChannel,
      date: dateToSave
    });

    setNewAmount('');
    setNewDate('');
  };

  const startEdit = (entry: IncomeEntry) => {
    setEditingId(entry.id);
    setEditSource(entry.source);
    setEditAmount(String(entry.amount));
    setEditChannel(entry.channel);
    setEditDate(entry.date);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    await onSaveIncome({
      id,
      month_id: activeMonthId,
      source: editSource,
      amount: Number(editAmount) || 0,
      channel: editChannel,
      date: editDate
    });
    setEditingId(null);
  };

  const totalIncome = incomeEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Styling helper for sources colors
  const getSourceBadgeColor = (source: IncomeSource) => {
    switch (source) {
      case 'מקסימוס': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'UPS': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'מזומן': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'העברה בנקאית': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
      case 'קארדקום': return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top statistics overview card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121212] border border-zinc-800 p-6 rounded-2xl gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">רישום ומעקב הכנסות</h2>
          <p className="text-sm text-zinc-500 mt-1">
            ניהול של כל שערי ההכנסה של הסטודיו, המורכבים מחמישה ערוצי הפצה מרכזיים
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-xl text-center shrink-0">
          <span className="text-xs text-zinc-500 block">סה״כ הכנסות החודש</span>
          <span className="text-2xl font-black font-mono text-[#22c55e]">
            {totalIncome.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
          </span>
        </div>
      </div>

      {/* 1. Weekly Breakdown Matrix Table */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-900/30 border-b border-zinc-800 flex items-center gap-2">
          <Coins className="w-5 h-5 text-green-500" />
          <span className="text-sm font-bold text-zinc-200">מטריצת פילוח שבועי של הכנסות</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/20">
                <th className="p-4 font-bold text-zinc-300">מקור הכנסה</th>
                {channelsList.map(channel => (
                  <th key={channel} className="p-4 text-center font-semibold">{channel}</th>
                ))}
                <th className="p-4 text-left font-bold text-green-400">סה״כ מצטבר</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {sourcesList.map(source => {
                const sourceTotal = channelsList.reduce((acc, curr) => acc + getMatrixValue(source, curr), 0);
                return (
                  <tr key={source} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="p-4 font-semibold text-white">
                      <span className={`px-2.5 py-1 rounded border text-xs font-semibold ${getSourceBadgeColor(source)}`}>
                        {source}
                      </span>
                    </td>
                    {channelsList.map(channel => {
                      const val = getMatrixValue(source, channel);
                      return (
                        <td key={channel} className="p-4 text-center font-mono">
                          {val > 0 ? (
                            <span className="text-zinc-200">{val.toLocaleString()} ₪</span>
                          ) : (
                            <span className="text-zinc-650">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-4 text-left font-bold font-mono text-[#22c55e] bg-zinc-900/10">
                      {sourceTotal.toLocaleString()} ₪
                    </td>
                  </tr>
                );
              })}

              {/* Column/Weekly totals row */}
              <tr className="bg-zinc-900/40 font-bold border-t border-zinc-700/80">
                <td className="p-4 text-white">סה״כ שבועי:</td>
                {channelsList.map(channel => {
                  const weekTotal = sourcesList.reduce((acc, curr) => acc + getMatrixValue(curr, channel), 0);
                  return (
                    <td key={channel} className="p-4 text-center font-mono text-[#22c55e]">
                      {weekTotal.toLocaleString()} ₪
                    </td>
                  );
                })}
                <td className="p-4 text-left font-black font-mono text-emerald-500 bg-zinc-900/20 text-base">
                  {totalIncome.toLocaleString()} ₪
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Detailed Entries List Table */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-900/30 border-b border-zinc-800">
          <span className="text-xs font-bold text-zinc-300 tracking-wider">פירוט פעילויות הכנסות מלא</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/10">
                <th className="p-4 font-semibold w-1/5">תאריך</th>
                <th className="p-4 font-semibold w-1/4">מקור הכנסה</th>
                <th className="p-4 font-semibold w-1/4">שיוך שבועי</th>
                <th className="p-4 font-semibold w-1/5">סכום</th>
                <th className="p-4 font-semibold text-center w-1/10">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {incomeEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-655">
                     טרם הוזנו רשימות הכנסה לחודש זה.
                  </td>
                </tr>
              ) : (
                incomeEntries.map((curr) => {
                  const isEditing = editingId === curr.id;

                  return (
                    <tr 
                      key={curr.id}
                      className={`hover:bg-zinc-900/35 transition-colors duration-200 ${
                        isEditing ? 'bg-zinc-900/60' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="p-4 font-mono text-zinc-400">
                        {isEditing ? (
                          <input
                            id={`edit-inc-date-${curr.id}`}
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                          />
                        ) : (
                          <span>{curr.date}</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="p-4">
                        {isEditing ? (
                          <select
                            id={`edit-inc-source-${curr.id}`}
                            value={editSource}
                            onChange={(e) => setEditSource(e.target.value as IncomeSource)}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 outline-none"
                          >
                            {sourcesList.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-1.5 rounded-lg text-xs font-bold leading-none ${getSourceBadgeColor(curr.source)}`}>
                            {curr.source}
                          </span>
                        )}
                      </td>

                      {/* Column / Week */}
                      <td className="p-4 text-zinc-400">
                        {isEditing ? (
                          <select
                            id={`edit-inc-channel-${curr.id}`}
                            value={editChannel}
                            onChange={(e) => setEditChannel(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-green-500 outline-none"
                          >
                            {channelsList.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span className="bg-zinc-900 px-2 py-1 rounded inline-flex items-center gap-1 text-xs border border-zinc-800/80 font-medium">
                            <CalendarCheck className="w-3.5 h-3.5 text-green-500" />
                            {curr.channel}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-4 font-mono text-[#22c55e] font-bold">
                        {isEditing ? (
                          <input
                            id={`edit-inc-amount-${curr.id}`}
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-white outline-none font-mono focus:border-green-500"
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
                              <button
                                id={`save-inc-${curr.id}`}
                                onClick={() => handleSaveEdit(curr.id)}
                                className="p-1.5 hover:bg-green-950/40 text-green-400 rounded transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                id={`cancel-inc-${curr.id}`}
                                onClick={cancelEdit}
                                className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                id={`edit-inc-${curr.id}`}
                                onClick={() => startEdit(curr)}
                                className="p-1.5 hover:bg-zinc-800 hover:text-[#22c55e] text-zinc-500 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`delete-inc-${curr.id}`}
                                onClick={() => onDeleteIncome(curr.id)}
                                className="p-1.5 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 rounded transition-colors"
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

      {/* 3. Add New Entry Form */}
      <div className="bg-[#121212] border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#22c55e]" />
          רישום הכנסה חדשה
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">ערוץ / מקור הכנסה *</label>
            <select
              id="new-inc-source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value as IncomeSource)}
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-3 py-2.5 text-sm text-white focus:border-green-500"
            >
              {sourcesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">סרטון סכום בשקלים (₪) *</label>
            <input
              id="new-inc-amount"
              type="number"
              required
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium font-sans">שיוך שבועי של התזרים</label>
            <select
              id="new-inc-channel"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-3 py-2.5 text-sm text-white focus:border-green-500 font-sans"
            >
              {channelsList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-zinc-400 font-medium">תאריך הקבלה</label>
              <input
                id="new-inc-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-green-500"
              />
            </div>
            
            <button
              id="add-inc-btn"
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-black font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-green-500/10"
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
