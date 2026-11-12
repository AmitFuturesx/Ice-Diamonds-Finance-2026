import React, { useState } from 'react';
import { Debt, PaymentStatus } from '../types';
import { Plus, Trash2, Edit2, Check, X, ShieldCheck, Landmark, CalendarClock } from 'lucide-react';

interface DebtsViewProps {
  debts: Debt[];
  activeMonthId: string;
  onSaveDebt: (debt: Omit<Debt, 'id'> & { id?: string }) => Promise<void>;
  onDeleteDebt: (id: string) => Promise<void>;
}

type StatusFilter = 'all' | PaymentStatus;

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
  const [newPaymentDate, setNewPaymentDate] = useState('');
  const [newStatus, setNewStatus] = useState<PaymentStatus>('לא שולם');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMonthlyPayment, setEditMonthlyPayment] = useState('');
  const [editCurrentBalance, setEditCurrentBalance] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('לא שולם');

  // Which status the table is filtered to (via the clickable summary blocks)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const statusOf = (d: Debt): PaymentStatus => d.status || 'לא שולם';

  // How many payments remain AFTER the current month until the debt is cleared.
  // Current balance ÷ monthly payment, minus this month's payment.
  const remainingPayments = (d: Debt): number | null => {
    const pay = Number(d.monthly_payment) || 0;
    const bal = Number(d.current_balance) || 0;
    if (pay <= 0) return null;
    return Math.max(0, Math.ceil(bal / pay) - 1);
  };

  const remainingPaymentsLabel = (n: number | null): string => {
    if (n === null) return '';
    if (n === 0) return 'התשלום האחרון החודש 🎉';
    if (n === 1) return 'נותר תשלום 1';
    return `נותרו ${n} תשלומים`;
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newMonthlyPayment || !newCurrentBalance) return;

    const startingBalance = Number(newCurrentBalance) || 0;
    await onSaveDebt({
      month_id: activeMonthId,
      name: newName,
      monthly_payment: Number(newMonthlyPayment) || 0,
      current_balance: startingBalance,
      original_amount: startingBalance, // Starting balance is the original principal
      payment_date: newPaymentDate || 'לא סומן',
      status: newStatus
    });

    setNewName('');
    setNewMonthlyPayment('');
    setNewCurrentBalance('');
    setNewPaymentDate('');
    setNewStatus('לא שולם');
  };

  const startEdit = (debt: Debt) => {
    setEditingId(debt.id);
    setEditName(debt.name);
    setEditMonthlyPayment(String(debt.monthly_payment));
    setEditCurrentBalance(String(debt.current_balance));
    setEditPaymentDate(debt.payment_date);
    setEditStatus(statusOf(debt));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string, existingOriginal: number) => {
    await onSaveDebt({
      id,
      month_id: activeMonthId,
      name: editName,
      monthly_payment: Number(editMonthlyPayment) || 0,
      current_balance: Number(editCurrentBalance) || 0,
      original_amount: existingOriginal, // Preserved — not editable in the UI
      payment_date: editPaymentDate,
      status: editStatus
    });
    setEditingId(null);
  };

  // Clickable 3-state cycle toggle: שולם -> שולם חלקית -> לא שולם -> שולם
  const handleCycleStatus = async (item: Debt) => {
    const nextStatusMap: Record<PaymentStatus, PaymentStatus> = {
      'שולם': 'שולם חלקית',
      'שולם חלקית': 'לא שולם',
      'לא שולם': 'שולם'
    };
    await onSaveDebt({ ...item, status: nextStatusMap[statusOf(item)] });
  };

  // Compute stats
  const totalMonthlyDebtRepayment = debts.reduce((acc, curr) => acc + (Number(curr.monthly_payment) || 0), 0);
  const totalOutstandingBalance = debts.reduce((acc, curr) => acc + (Number(curr.current_balance) || 0), 0);
  const totalOriginalDebt = debts.reduce((acc, curr) => acc + (Number(curr.original_amount) || 0), 0);

  const totalRepaidAmount = Math.max(0, totalOriginalDebt - totalOutstandingBalance);
  const globalRepaymentPercent = totalOriginalDebt > 0 ? (totalRepaidAmount / totalOriginalDebt) * 100 : 0;

  // Status-based totals (by monthly repayment) for the summary/filter blocks
  const sumMonthlyFor = (status: PaymentStatus) =>
    debts.filter((d) => statusOf(d) === status).reduce((acc, d) => acc + (Number(d.monthly_payment) || 0), 0);

  const paidMonthly = sumMonthlyFor('שולם');
  const partialMonthly = sumMonthlyFor('שולם חלקית');
  const unpaidMonthly = sumMonthlyFor('לא שולם');
  const remainingMonthly = partialMonthly + unpaidMonthly;

  const visibleDebts =
    statusFilter === 'all' ? debts : debts.filter((d) => statusOf(d) === statusFilter);

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
      label: 'סה״כ החזר חודשי',
      amount: totalMonthlyDebtRepayment,
      count: debts.length,
      activeClasses: 'border-emerald-400 bg-emerald-50',
      accentText: 'text-emerald-600'
    },
    {
      key: 'שולם',
      label: 'שולם',
      amount: paidMonthly,
      count: debts.filter((d) => statusOf(d) === 'שולם').length,
      activeClasses: 'border-emerald-500 bg-emerald-50',
      accentText: 'text-emerald-600'
    },
    {
      key: 'שולם חלקית',
      label: 'שולם חלקית',
      amount: partialMonthly,
      count: debts.filter((d) => statusOf(d) === 'שולם חלקית').length,
      activeClasses: 'border-amber-400 bg-amber-50',
      accentText: 'text-amber-700'
    },
    {
      key: 'לא שולם',
      label: 'נותר לשלם',
      amount: remainingMonthly,
      count: debts.filter((d) => statusOf(d) === 'לא שולם').length,
      activeClasses: 'border-rose-400 bg-rose-50',
      accentText: 'text-rose-600'
    }
  ];

  return (
    <div className="space-y-6">

      {/* Header Info Dashboard banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 bg-white shadow-card rounded-[1.6rem] overflow-hidden ">
        <div className="p-6 space-y-1">
          <h2 className="text-xl font-bold text-ink">התחייבויות וחובות</h2>
          <p className="text-xs text-slate-500">
            מעקב אחר פרעון הלוואות בנקאיות, מימון מכונות וליסינג עסקי
          </p>
          <div className="pt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4.5 h-4.5" />
            <span>כל הנתונים מעודכנים לתקופת הדו״ח</span>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t md:border-t-0 md:border-r border-line text-center flex flex-col justify-center">
          <span className="text-xs text-slate-500 block">סה״כ החזר חודשי החודש</span>
          <span className="text-2xl font-black font-mono text-rose-600 mt-1">
            {fmtCurrency(totalMonthlyDebtRepayment)}
          </span>
        </div>

        <div className="p-6 bg-slate-50 border-t md:border-t-0 md:border-r border-line text-center flex flex-col justify-center">
          <span className="text-xs text-slate-500 block">יתרת חוב כוללת לפירעון</span>
          <span className="text-2xl font-black font-mono text-emerald-600 mt-1">
            {fmtCurrency(totalOutstandingBalance)}
          </span>
        </div>
      </div>

      {/* Clickable status summary blocks (act as filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => {
          const isActive = statusFilter === card.key;
          return (
            <button
              key={card.key}
              id={`debt-filter-card-${card.key}`}
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
            id="debt-clear-filter-btn"
            onClick={() => setStatusFilter('all')}
            className="text-emerald-600 hover:underline"
          >
            הצג הכל
          </button>
        </div>
      )}

      {/* Repayment Progress overview */}
      <div className="bg-white shadow-card p-5 rounded-[1.6rem]">
        <div className="flex justify-between text-xs text-slate-500 mb-2 font-medium">
          <span>מדד פירעון חוב גלובלי (כמה סילקנו מסך הקרן המקורית)</span>
          <span className="text-emerald-600 font-bold">{globalRepaymentPercent.toFixed(1)}% שולם</span>
        </div>
        <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-line flex">
          <div
            className="bg-navy h-full rounded-full transition-all duration-700"
            style={{ width: `${globalRepaymentPercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 font-mono">
          <span>סולק: {totalRepaidAmount.toLocaleString('he-IL')} ₪</span>
          <span>קרן מקורית: {totalOriginalDebt.toLocaleString('he-IL')} ₪</span>
        </div>
      </div>

      {/* Debts Table */}
      <div className="bg-white shadow-card rounded-[1.6rem] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-line text-xs text-slate-500 bg-slate-50/60">
                <th className="p-4 font-semibold w-1/6">גורם מלווה / ספק</th>
                <th className="p-4 font-semibold w-[13%]">החזר חודשי</th>
                <th className="p-4 font-semibold w-[15%]">יתרת חוב נוכחית</th>
                <th className="p-4 font-semibold w-[13%] text-center">יום בחודש לחיוב</th>
                <th className="p-4 font-semibold text-center w-[12%]">סטטוס תשלום</th>
                <th className="p-4 font-semibold text-center w-[15%]">התקדמות פירעון</th>
                <th className="p-4 font-semibold text-center w-1/12">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm text-ink-2">
              {visibleDebts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {debts.length === 0
                      ? 'אין חובות או התחייבויות פתוחים לחודש הנבחר.'
                      : 'אין חובות בסטטוס הנבחר.'}
                  </td>
                </tr>
              ) : (
                visibleDebts.map((item) => {
                  const isEditing = editingId === item.id;
                  const repaid = Math.max(0, (item.original_amount || 0) - (item.current_balance || 0));
                  const repaidPercent = item.original_amount > 0 ? (repaid / item.original_amount) * 100 : 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors duration-200 ${
                        isEditing ? 'bg-slate-50' : ''
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
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-full outline-none focus:border-navy"
                          />
                        ) : (
                          <span className="font-semibold text-ink flex items-center gap-2">
                            <Landmark className="w-3.5 h-3.5 text-slate-500" />
                            {item.name}
                          </span>
                        )}
                      </td>

                      {/* Monthly Payment */}
                      <td className="p-4 font-mono text-xs font-semibold text-rose-600">
                        {isEditing ? (
                          <input
                            id={`edit-debt-monthly-${item.id}`}
                            type="number"
                            value={editMonthlyPayment}
                            onChange={(e) => setEditMonthlyPayment(e.target.value)}
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-full outline-none font-mono focus:border-navy"
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
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-full outline-none font-mono focus:border-navy"
                          />
                        ) : (
                          <span className="text-emerald-600 font-bold">
                            {Number(item.current_balance).toLocaleString('he-IL')} ₪
                          </span>
                        )}
                      </td>

                      {/* Payment Date */}
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <input
                            id={`edit-debt-date-${item.id}`}
                            type="text"
                            value={editPaymentDate}
                            onChange={(e) => setEditPaymentDate(e.target.value)}
                            className="bg-white border border-line rounded px-2.5 py-1.5 text-sm text-ink w-20 outline-none text-center focus:border-navy"
                          />
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold ${
                              !item.payment_date || item.payment_date === 'לא סומן'
                                ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                : 'bg-sky-50 text-sky-700 border border-sky-200'
                            }`}
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            {!item.payment_date || item.payment_date === 'לא סומן'
                              ? 'לא ידוע'
                              : `${item.payment_date} לחודש`}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <select
                            id={`edit-debt-status-${item.id}`}
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
                            id={`debt-status-badge-${item.id}`}
                            onClick={() => handleCycleStatus(item)}
                            title="לחץ לשינוי מהיר"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer select-none transition-all duration-300 hover:scale-105 active:scale-95 ${getStatusBadgeStyles(statusOf(item))}`}
                          >
                            {statusOf(item)}
                          </button>
                        )}
                      </td>

                      {/* Progress visual */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-navy h-full rounded-full transition-all duration-300"
                              style={{ width: `${repaidPercent}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>{repaidPercent.toFixed(0)}% סולק</span>
                            <span>נותר: {(item.current_balance || 0).toLocaleString()}</span>
                          </div>
                          {remainingPayments(item) !== null && (
                            <div className="pt-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  remainingPayments(item) === 0
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-sky-50 text-sky-700 border border-sky-200'
                                }`}
                              >
                                {remainingPaymentsLabel(remainingPayments(item))}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                id={`save-debt-${item.id}`}
                                onClick={() => handleSaveEdit(item.id, item.original_amount)}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition-colors"
                                title="שמור"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                id={`cancel-debt-${item.id}`}
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
                                id={`edit-debt-${item.id}`}
                                onClick={() => startEdit(item)}
                                className="p-1.5 hover:bg-slate-100 hover:text-navy text-slate-500 rounded transition-colors"
                                title="ערוך"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`delete-debt-${item.id}`}
                                onClick={() => onDeleteDebt(item.id)}
                                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded transition-colors"
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
      </div>

      {/* Add New Debt Form Box */}
      <div className="bg-white shadow-card p-6 rounded-[1.6rem]">
        <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-600" />
          הוספת התחייבות / הלוואה חדשה
        </h3>

        <form onSubmit={handleAddNew} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">גורם מממן / ספק ההלוואה *</label>
            <input
              id="new-debt-name"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="לדוג׳ בנק דיסקונט, ליסינג כלי עבודה..."
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink focus:border-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">החזר חודשי (₪) *</label>
            <input
              id="new-debt-monthly"
              type="number"
              required
              value={newMonthlyPayment}
              onChange={(e) => setNewMonthlyPayment(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink font-mono focus:border-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">יתרת חוב נוכחית (₪) *</label>
            <input
              id="new-debt-balance"
              type="number"
              required
              value={newCurrentBalance}
              onChange={(e) => setNewCurrentBalance(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-4 py-2.5 text-sm text-ink font-mono focus:border-navy"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">סטטוס</label>
            <select
              id="new-debt-status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as PaymentStatus)}
              className="w-full bg-slate-50 border border-line outline-none rounded-xl px-3 py-2.5 text-sm text-ink focus:border-navy"
            >
              <option value="לא שולם">לא שולם</option>
              <option value="שולם חלקית">שולם חלקית</option>
              <option value="שולם">שולם</option>
            </select>
          </div>

          <div className="flex gap-2">
            <div className="space-y-1 flex-grow">
              <label className="text-xs text-slate-500 font-medium">יום חיוב (1-31)</label>
              <input
                id="new-debt-paydate"
                type="text"
                value={newPaymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                placeholder="לדוג׳ 10"
                className="w-full bg-slate-50 border border-line outline-none rounded-xl px-3 py-2.5 text-sm text-ink focus:border-navy text-center"
              />
            </div>

            <button
              id="add-debt-btn"
              type="submit"
              className="bg-navy hover:bg-navy-2 text-white font-bold h-[42px] px-4 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-sm shrink-0 shadow-lg shadow-navy/15"
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
