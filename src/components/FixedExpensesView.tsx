import React, { useState } from 'react';
import { FixedExpense, PaymentStatus } from '../types';
import { Plus, Trash2, Edit2, Check, X, FileSpreadsheet, Save } from 'lucide-react';

interface FixedExpensesViewProps {
  expenses: FixedExpense[];
  activeMonthId: string;
  onSaveExpense: (expense: Omit<FixedExpense, 'id'> & { id?: string }) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

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
  
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('לא שולם');

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;

    await onSaveExpense({
      month_id: activeMonthId,
      name: newName,
      amount: Number(newAmount) || 0,
      notes: newNotes,
      status: newStatus
    });

    // Reset controls
    setNewName('');
    setNewAmount('');
    setNewNotes('');
    setNewStatus('לא שולם');
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

  const handleSaveEdit = async (id: string) => {
    await onSaveExpense({
      id,
      month_id: activeMonthId,
      name: editName,
      amount: Number(editAmount) || 0,
      notes: editNotes,
      status: editStatus
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
    const nextStatus = nextStatusMap[item.status];
    await onSaveExpense({
      ...item,
      status: nextStatus
    });
  };

  const totalFixed = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Styling helper for the status badge
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

  return (
    <div className="space-y-6">
      
      {/* Header Summary Info card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#121212] border border-zinc-800 p-6 rounded-2xl gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">הוצאות קבועות</h2>
          <p className="text-sm text-zinc-500 mt-1">
            מעקב אחר תשלומים גבוהים בעלי מחזור קבוע (שכירות, ארנונה, תקשורת וכדומה)
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-xl text-center">
          <span className="text-xs text-zinc-500 block">סה״כ הוצאות קבועות</span>
          <span className="text-2xl font-black font-mono text-[#22c55e]">
            {totalFixed.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
          </span>
        </div>
      </div>

      {/* Main Table Wrapper */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-900/30 border-b border-zinc-800/80 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-300 tracking-wider">טבלת הוצאות קבועות</span>
          <span className="text-xs text-zinc-500">לחץ על תג סטטוס כדי לשנותו במהירות</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/10">
                <th className="p-4 font-semibold w-1/4">שם ההוצאה</th>
                <th className="p-4 font-semibold w-1/6">סכום</th>
                <th className="p-4 font-semibold w-1/3">הערות ופירוט</th>
                <th className="p-4 font-semibold text-center w-1/6">סטטוס תשלום</th>
                <th className="p-4 font-semibold text-center w-1/8">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-600">
                     אין הוצאות קבועות רשומות לחודש הנבחר.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => {
                  const isEditing = editingId === exp.id;

                  return (
                    <tr 
                      key={exp.id} 
                      className={`hover:bg-zinc-900/35 transition-colors duration-200 ${
                        isEditing ? 'bg-zinc-900/60' : ''
                      }`}
                    >
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
                            {Number(exp.amount).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
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
                                onClick={() => handleSaveEdit(exp.id)}
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
        
        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
