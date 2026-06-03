import React, { useState } from 'react';
import { Debt } from '../types';
import { Plus, Trash2, Edit2, Check, X, ShieldCheck, Landmark } from 'lucide-react';

interface DebtsViewProps {
  debts: Debt[];
  activeMonthId: string;
  onSaveDebt: (debt: Omit<Debt, 'id'> & { id?: string }) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
}

export default function DebtsView({
  debts,
  activeMonthId,
  onSaveDebt,
  onDeleteDebt
}: DebtsViewProps) {
  // New debt form state
  const [newName, setNewName] = useState('');
  const [newMonthlyPayment, setNewMonthlyPayment] = useState('');
  const [newCurrentBalance, setNewCurrentBalance] = useState('');
  const [newOriginalAmount, setNewOriginalAmount] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editCurrentBalance, setEditCurrentBalance] = useState('');
  const [editOriginalAmount, setEditOriginalAmount] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newMonthlyPayment || !newCurrentBalance || !newOriginalAmount) return;

    await onSaveDebt({
      month_id: activeMonthId,
      name: newName,
      monthly_payment: Number(newMonthlyPayment) || 0,
      current_balance: Number(newCurrentBalance) || 0,
      original_amount: Number(newOriginalAmount) || 0,
      payment_date: newPaymentDate || 'לא סומן'
    });

    // Reset controls
    setNewName('');
    setNewMonthlyPayment('');
    setNewCurrentBalance('');
    setNewOriginalAmount('');
    setNewPaymentDate('');
  };

  const startEdit = (debt: Debt) => {
    setEditingId(debt.id);
    setEditName(debt.name);
    setEditMonthlyPayment(String(debt.monthly_payment));
    setEditCurrentBalance(String(debt.current_balance));
    setEditOriginalAmount(String(debt.original_amount));
    setEditPaymentDate(debt.payment_date);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    await onSaveDebt({
      id,
      month_id: activeMonthId,
      name: editName,
      monthly_payment: Number(editMonthlyPayment) || 0,
      current_balance: Number(editCurrentBalance) || 0,
      original_amount: Number(editOriginalAmount) || 0,
      payment_date: editPaymentDate
    });
    setEditingId(null);
  };

  // Compute stats
  const totalMonthlyDebtRepayment = debts.reduce((acc, curr) => acc + (Number(curr.monthly_payment) || 0), 0);
  const totalOutstandingBalance = debts.reduce((acc, curr) => acc + (Number(curr.current_balance) || 0), 0);
  const totalOriginalDebt = debts.reduce((acc, curr) => acc + (Number(curr.original_amount) || 0), 0);

  // Compute global repaid ratio
  const totalRepaidAmount = Math.max(0, totalOriginalDebt - totalOutstandingBalance);
  const globalRepaymentPercent = totalOriginalDebt > 0 ? (totalRepaidAmount / totalOriginalDebt) * 100 : 0;

  return (
    <div className="space-y-6">
      
      {/* Header Info Dashboard banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 space-y-1">
          <h2 className="text-xl font-bold text-white">התחייבויות וחובות</h2>
          <p className="text-xs text-zinc-500">
            מעקב אחר פרעון הלוואות בנקאיות, מימון מכונות וליסינג עסקי
          </p>
          <div className="pt-2 text-xs text-[#22c55e] font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4.5 h-4.5" />
            <span>כל הנתונים מעודכנים לתקופת הדו״ח</span>
          </div>
        </div>

        <div className="p-6 bg-zinc-900/30 border-t md:border-t-0 md:border-r border-zinc-800 text-center flex flex-col justify-center">
          <span className="text-xs text-zinc-500 block">סה״כ החזר חודשי החודש</span>
          <span className="text-2xl font-black font-mono text-red-400 mt-1">
            {totalMonthlyDebtRepayment.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
          </span>
        </div>

        <div className="p-6 bg-zinc-900/50 border-t md:border-t-0 md:border-r border-zinc-800 text-center flex flex-col justify-center">
          <span className="text-xs text-zinc-500 block">יתרת חוב כוללת לפירעון</span>
          <span className="text-2xl font-black font-mono text-[#22c55e] mt-1">
            {totalOutstandingBalance.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
          </span>
        </div>
      </div>

      {/* Repayment Progress overview */}
      <div className="bg-[#121212] border border-zinc-800 p-5 rounded-2xl">
        <div className="flex justify-between text-xs text-zinc-400 mb-2 font-medium">
          <span>מדד פירעון חוב גלובלי (כמה סילקנו מסך הקרן המקורית)</span>
          <span className="text-[#22c55e] font-bold">{globalRepaymentPercent.toFixed(1)}% שולם</span>
        </div>
        <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800 flex">
          <div 
            className="bg-green-500 h-full rounded-full transition-all duration-700"
            style={{ width: `${globalRepaymentPercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[11px] text-zinc-500 mt-1.5 font-mono">
          <span>סולק: {totalRepaidAmount.toLocaleString('he-IL')} ₪</span>
          <span>קרן מקורית: {totalOriginalDebt.toLocaleString('he-IL')} ₪</span>
        </div>
      </div>

      {/* Debts Table */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/10">
              <th className="p-4 font-semibold w-1/5">גורם מלווה / ספק</th>
              <th className="p-4 font-semibold w-[15%]">החזר חודשי</th>
              <th className="p-4 font-semibold w-1/5">יתרת חוב נוכחית</th>
              <th className="p-4 font-semibold w-1/6 text-center">יום בחודש לחיוב</th>
              <th className="p-4 font-semibold w-1/5">סכום מקורי (קרן)</th>
              <th className="p-4 font-semibold text-center w-[15%]">התקדמות פירעון</th>
              <th className="p-4 font-semibold text-center w-1/12">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
            {debts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-600">
                  אין חובות או התחייבויות פתוחים לחודש הנבחר.
                </td>
              </tr>
            ) : (
              debts.map((item) => {
                const isEditing = editingId === item.id;
                
                // Repayment ratios
                const repaid = Math.max(0, (item.original_amount || 0) - (item.current_balance || 0));
                const repaidPercent = item.original_amount > 0 ? (repaid / item.original_amount) * 100 : 0;

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-zinc-900/35 transition-colors duration-200 ${
                      isEditing ? 'bg-zinc-900/60' : ''
                    }`}
                  >
                    {/* Lender Name */}
                    <td className="p-4">
                      {isEditing ? (
                        <input
                          id={`edit-debt-name-${item.id}`}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none focus:border-green-500"
                        />
                      ) : (
                        <span className="font-semibold text-white flex items-center gap-2">
                          <Landmark className="w-3.5 h-3.5 text-zinc-500" />
                          {item.name}
                        </span>
                      )}
                    </td>

                    {/* Monthly Payment */}
                    <td className="p-4 font-mono text-xs font-semibold text-red-400">
                      {isEditing ? (
                        <input
                          id={`edit-debt-monthly-${item.id}`}
                          type="number"
                          value={editMonthlyPayment}
                          onChange={(e) => setEditMonthlyPayment(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none font-mono focus:border-green-500"
                        />
                      ) : (
                        <span>-{Number(item.monthly_payment).toLocaleString('he-IL')} ₪</span>
                      )}
                    </td>

                    {/* Current Balance */}
                    <td className="p-4 font-mono text-xs">
                      {isEditing ? (
                        <input
                          id={`edit-debt-balance-${item.id}`}
                          type="number"
                          value={editCurrentBalance}
                          onChange={(e) => setEditCurrentBalance(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none font-mono focus:border-green-500"
                        />
                      ) : (
                        <span className="text-[#22c55e] font-bold">
                          {Number(item.current_balance).toLocaleString('he-IL')} ₪
                        </span>
                      )}
                    </td>

                    {/* Payment Date */}
                    <td className="p-4 text-center font-mono">
                      {isEditing ? (
                        <input
                          id={`edit-debt-date-${item.id}`}
                          type="text"
                          value={editPaymentDate}
                          onChange={(e) => setEditPaymentDate(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-20 outline-none text-center focus:border-green-500"
                        />
                      ) : (
                        <span className="bg-zinc-900 border border-zinc-800/85 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400">
                           ב-{item.payment_date} לחודש
                        </span>
                      )}
                    </td>

                    {/* Original Principal */}
                    <td className="p-4 font-mono text-zinc-400 text-xs">
                      {isEditing ? (
                        <input
                          id={`edit-debt-original-${item.id}`}
                          type="number"
                          value={editOriginalAmount}
                          onChange={(e) => setEditOriginalAmount(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-white w-full outline-none font-mono focus:border-green-500"
                        />
                      ) : (
                        <span>{Number(item.original_amount).toLocaleString('he-IL')} ₪</span>
                      )}
                    </td>

                    {/* Progress visual */}
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-green-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${repaidPercent}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                          <span>{repaidPercent.toFixed(0)}% סולק</span>
                          <span>נותר: {(item.current_balance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              id={`save-debt-${item.id}`}
                              onClick={() => handleSaveEdit(item.id)}
                              className="p-1.5 hover:bg-green-950/40 text-green-400 rounded transition-colors"
                              title="שמור"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              id={`cancel-debt-${item.id}`}
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
                              id={`edit-debt-${item.id}`}
                              onClick={() => startEdit(item)}
                              className="p-1.5 hover:bg-zinc-800 hover:text-[#22c55e] text-zinc-500 rounded transition-colors"
                              title="ערוך"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`delete-debt-${item.id}`}
                              onClick={() => onDeleteDebt(item.id)}
                              className="p-1.5 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 rounded transition-colors"
                              title="מחק"
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

      {/* Add New Debt Form Box */}
      <div className="bg-[#121212] border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#22c55e]" />
          הוספת התחייבות / הלוואה חדשה
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">גורם מממן / ספק ההלוואה *</label>
            <input
              id="new-debt-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="לדוג׳ בנק דיסקונט, ליסינג כלי עבודה..."
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">החזר חודשי (₪) *</label>
            <input
              id="new-debt-monthly"
              type="number"
              required
              value={newMonthlyPayment}
              onChange={(e) => setNewMonthlyPayment(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">יתרת חוב נוכחית (₪) *</label>
            <input
              id="new-debt-balance"
              type="number"
              required
              value={newCurrentBalance}
              onChange={(e) => setNewCurrentBalance(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">סל הלוואה מקורי / קרן (₪) *</label>
            <input
              id="new-debt-original"
              type="number"
              required
              value={newOriginalAmount}
              onChange={(e) => setNewOriginalAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-green-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-grow">
              <label className="text-xs text-zinc-400 font-medium">יום חיוב (1-31)</label>
              <input
                id="new-debt-paydate"
                type="text"
                value={newPaymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                placeholder="לדוג׳ 10"
                className="w-full bg-zinc-900 border border-zinc-800 outline-none rounded-xl px-3 py-2.5 text-sm text-white focus:border-green-500 text-center"
              />
            </div>

            <button
              id="add-debt-btn"
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-black font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-green-500/10"
              title="הוסף הלוואה"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
