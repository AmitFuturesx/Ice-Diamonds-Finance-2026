import React, { useState } from 'react';
import { Employee, EmployeeMonth, Department, VatMode, PaymentStatus } from '../types';
import { computePay, VAT_RATE } from '../lib/payroll';
import { Plus, Trash2, Edit2, X, Users, Briefcase, Store } from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  employeeMonths: EmployeeMonth[];
  activeMonthId: string;
  onSaveEmployee: (e: Omit<Employee, 'id'> & { id?: string }) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onSaveEmployeeMonth: (m: Omit<EmployeeMonth, 'id'> & { id?: string }) => Promise<void>;
}

const DEPARTMENTS: { key: Department; label: string; icon: typeof Users; roleHint: string }[] = [
  { key: 'freelancer', label: 'פרילנסרים', icon: Briefcase, roleHint: 'לדוג׳ שיווק לעסק' },
  { key: 'sales', label: 'אנשי מכירות', icon: Users, roleHint: 'לדוג׳ נציג מכירות' },
  { key: 'staff', label: 'עובדים נוספים', icon: Store, roleHint: 'לדוג׳ אחראית חנות' }
];

const VAT_LABEL: Record<VatMode, string> = {
  plus_vat: 'עוסק מורשה (+מע״מ)',
  exempt: 'עוסק פטור',
  none: 'שכיר (ללא מע״מ)'
};

const DEFAULT_VAT: Record<Department, VatMode> = { freelancer: 'plus_vat', sales: 'none', staff: 'none' };

const emptyEmployee = (department: Department): Omit<Employee, 'id'> => ({
  name: '',
  department,
  role: '',
  hourly_rate: 0,
  monthly_fee: 0,
  commission_pct: 0,
  manager_id: null,
  override_pct: 0,
  vat_mode: DEFAULT_VAT[department],
  active: true
});

const ils = (v: number) => v.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

const statusCls = (s: PaymentStatus) =>
  s === 'שולם'
    ? 'bg-green-950/40 text-green-400 border-green-500/30'
    : s === 'שולם חלקית'
    ? 'bg-amber-950/40 text-amber-400 border-amber-500/30'
    : 'bg-red-950/40 text-red-400 border-red-500/30';
const nextStatus = (s: PaymentStatus): PaymentStatus =>
  s === 'לא שולם' ? 'שולם חלקית' : s === 'שולם חלקית' ? 'שולם' : 'לא שולם';

export default function EmployeesView({
  employees,
  employeeMonths,
  activeMonthId,
  onSaveEmployee,
  onDeleteEmployee,
  onSaveEmployeeMonth
}: EmployeesViewProps) {
  const [dept, setDept] = useState<Department>('sales');
  // Add/edit form (null = closed)
  const [form, setForm] = useState<(Omit<Employee, 'id'> & { id?: string }) | null>(null);

  const monthsByEmployee: Record<string, EmployeeMonth | undefined> = {};
  employeeMonths.forEach((m) => (monthsByEmployee[m.employee_id] = m));

  const rows = employees.map((e) => {
    const m = monthsByEmployee[e.id];
    return { emp: e, month: m, pay: computePay(e, m, employees, monthsByEmployee), status: (m?.status || 'לא שולם') as PaymentStatus };
  });

  // Whole-payroll totals for the month
  const totalOwed = rows.reduce((a, r) => a + r.pay.total, 0);
  const totalPaid = rows.filter((r) => r.status === 'שולם').reduce((a, r) => a + r.pay.total, 0);
  const totalVat = rows.reduce((a, r) => a + r.pay.vat, 0);
  const deptTotal = (d: Department) => rows.filter((r) => r.emp.department === d).reduce((a, r) => a + r.pay.total, 0);

  const deptRows = rows.filter((r) => r.emp.department === dept);
  const salesPeople = employees.filter((e) => e.department === 'sales');

  // Save one monthly field (creates the month row on first edit)
  const saveMonthField = (emp: Employee, patch: Partial<EmployeeMonth>) => {
    const m = monthsByEmployee[emp.id];
    onSaveEmployeeMonth({
      employee_id: emp.id,
      month_id: activeMonthId,
      hours: m?.hours || 0,
      deals_count: m?.deals_count || 0,
      deals_amount: m?.deals_amount || 0,
      status: m?.status || 'לא שולם',
      notes: m?.notes || '',
      ...patch
    });
  };

  // Number input that saves on blur only when the value actually changed
  const monthInput = (emp: Employee, field: 'hours' | 'deals_count' | 'deals_amount', width = 'w-20') => {
    const current = Number(monthsByEmployee[emp.id]?.[field]) || 0;
    return (
      <input
        key={`${emp.id}-${activeMonthId}-${field}-${current}`}
        type="number"
        min="0"
        defaultValue={current || ''}
        placeholder="0"
        onBlur={(ev) => {
          const v = Number(ev.target.value) || 0;
          if (v !== current) saveMonthField(emp, { [field]: v });
        }}
        onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
        className={`${width} bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-white font-mono outline-none focus:border-green-500`}
      />
    );
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    await onSaveEmployee({ ...form, name: form.name.trim(), manager_id: form.department === 'sales' ? form.manager_id : null });
    setForm(null);
  };

  const removeEmployee = (emp: Employee) => {
    if (confirm(`למחוק את ${emp.name}? כל נתוני השכר שלו בכל החודשים יימחקו.`)) onDeleteEmployee(emp.id);
  };

  const isFreelancer = dept === 'freelancer';
  const numField = (key: keyof Employee, label: string, suffix: string) => (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="any"
          value={(form?.[key] as number) || ''}
          placeholder="0"
          onChange={(ev) => setForm((f) => (f ? { ...f, [key]: Number(ev.target.value) || 0 } : f))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-green-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#121212] border border-zinc-800 p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white">ניהול עובדים ושכר</h2>
        <p className="text-sm text-zinc-500 mt-1">פרילנסרים, אנשי מכירות ועובדים נוספים — כמה מגיע לכל אחד החודש וכמה נשאר לשלם</p>
      </div>

      {/* Payroll totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-4">
          <span className="text-xs text-zinc-400 block mb-1">סה״כ שכר החודש</span>
          <span className="text-xl font-black font-mono text-white">{ils(totalOwed)}</span>
        </div>
        <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-4">
          <span className="text-xs text-zinc-400 block mb-1">נותר לשלם</span>
          <span className="text-xl font-black font-mono text-rose-400">{ils(totalOwed - totalPaid)}</span>
        </div>
        <div className="bg-green-950/20 border border-green-500/30 rounded-2xl p-4">
          <span className="text-xs text-zinc-400 block mb-1">כבר שולם</span>
          <span className="text-xl font-black font-mono text-[#22c55e]">{ils(totalPaid)}</span>
        </div>
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-4">
          <span className="text-xs text-zinc-400 block mb-1">מתוכו מע״מ ({Math.round(VAT_RATE * 100)}%)</span>
          <span className="text-xl font-black font-mono text-amber-400">{ils(totalVat)}</span>
        </div>
      </div>

      {/* Department tabs */}
      <div className="grid grid-cols-3 gap-2">
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          const active = dept === d.key;
          return (
            <button
              key={d.key}
              onClick={() => setDept(d.key)}
              className={`text-right p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                active ? 'border-[#22c55e] bg-[#22c55e]/10' : 'border-zinc-800 bg-[#121212] hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#22c55e]' : 'text-zinc-500'}`} />
                <span className="truncate">{d.label}</span>
                <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 rounded-full">
                  {employees.filter((e) => e.department === d.key).length}
                </span>
              </div>
              <span className="text-sm sm:text-lg font-black font-mono text-zinc-200 block mt-1">{ils(deptTotal(d.key))}</span>
            </button>
          );
        })}
      </div>

      {/* Department table */}
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-zinc-900/30 border-b border-zinc-800 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-zinc-200">{DEPARTMENTS.find((d) => d.key === dept)?.label}</span>
          <button
            onClick={() => setForm(emptyEmployee(dept))}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-black text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            הוסף {dept === 'sales' ? 'נציג' : dept === 'freelancer' ? 'פרילנסר' : 'עובד'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-900/10">
                <th className="p-3 font-semibold">שם</th>
                {!isFreelancer && <th className="p-3 font-semibold">שעות החודש</th>}
                {!isFreelancer && <th className="p-3 font-semibold">עסקאות</th>}
                {!isFreelancer && <th className="p-3 font-semibold">סכום העסקאות (₪)</th>}
                <th className="p-3 font-semibold">פירוט התשלום</th>
                <th className="p-3 font-semibold">מע״מ</th>
                <th className="p-3 font-semibold">לתשלום</th>
                <th className="p-3 font-semibold text-center">סטטוס</th>
                <th className="p-3 font-semibold text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm text-zinc-300">
              {deptRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-600">עוד אין אנשים במחלקה הזו — לחץ "הוסף" למעלה.</td>
                </tr>
              ) : (
                deptRows.map(({ emp, pay, status }) => {
                  const manager = employees.find((x) => x.id === emp.manager_id);
                  return (
                    <tr key={emp.id} className="hover:bg-zinc-900/35 align-top">
                      <td className="p-3">
                        <div className="font-semibold text-white">{emp.name}</div>
                        <div className="text-xs text-zinc-500">
                          {emp.role || '—'}
                          {manager ? ` · תחת ${manager.name}` : ''}
                        </div>
                      </td>
                      {!isFreelancer && (
                        <td className="p-3">
                          {monthInput(emp, 'hours')}
                        </td>
                      )}
                      {!isFreelancer && (
                        <td className="p-3">
                          {monthInput(emp, 'deals_count', 'w-16')}
                        </td>
                      )}
                      {!isFreelancer && (
                        <td className="p-3">
                          {monthInput(emp, 'deals_amount', 'w-28')}
                        </td>
                      )}
                      <td className="p-3 text-xs text-zinc-400 space-y-0.5 whitespace-nowrap">
                        {pay.fixedPay > 0 && <div>קבוע: {ils(pay.fixedPay)}</div>}
                        {emp.hourly_rate > 0 && <div>שעתי: {ils(pay.hourlyPay)} <span className="text-zinc-600">({emp.hourly_rate} ₪/ש׳)</span></div>}
                        {emp.commission_pct > 0 && <div>עמלה {emp.commission_pct}%: {ils(pay.ownCommission)}</div>}
                        {emp.override_pct > 0 && <div className="text-sky-300">מהצוות {emp.override_pct}%: {ils(pay.overridePay)}</div>}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        <div className={emp.vat_mode === 'plus_vat' ? 'text-amber-400' : 'text-zinc-500'}>{VAT_LABEL[emp.vat_mode]}</div>
                        {pay.vat > 0 && <div className="font-mono text-amber-400">+{ils(pay.vat)}</div>}
                      </td>
                      <td className="p-3 font-mono font-black text-white whitespace-nowrap">{ils(pay.total)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => saveMonthField(emp, { status: nextStatus(status) })}
                          title="לחץ לשינוי הסטטוס"
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap cursor-pointer hover:scale-105 transition-all ${statusCls(status)}`}
                        >
                          {status}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setForm({ ...emp })} className="p-1.5 hover:bg-zinc-800 hover:text-[#22c55e] text-zinc-500 rounded" title="עריכת הגדרות">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeEmployee(emp)} className="p-1.5 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 rounded" title="מחק">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isFreelancer && deptRows.length > 0 && (
          <p className="px-4 py-3 text-[11px] text-zinc-500 border-t border-zinc-800">
            ממלאים שעות, כמות עסקאות וסכום העסקאות לחודש הנבחר — זה נשמר אוטומטית כשיוצאים מהשדה. העמלה מחושבת מסכום העסקאות.
          </p>
        )}
      </div>

      {/* Add / edit employee modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setForm(null)}></div>
          <form onSubmit={submitForm} className="relative bg-[#121212] border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">{form.id ? `עריכת ${form.name}` : 'הוספת איש צוות'}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-2 text-zinc-400 hover:text-white rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">שם *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(ev) => setForm({ ...form, name: ev.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">תפקיד</label>
                  <input
                    value={form.role}
                    placeholder={DEPARTMENTS.find((d) => d.key === form.department)?.roleHint}
                    onChange={(ev) => setForm({ ...form, role: ev.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">מחלקה</label>
                  <select
                    value={form.department}
                    onChange={(ev) => setForm({ ...form, department: ev.target.value as Department })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  >
                    {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">מע״מ</label>
                  <select
                    value={form.vat_mode}
                    onChange={(ev) => setForm({ ...form, vat_mode: ev.target.value as VatMode })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  >
                    {(Object.keys(VAT_LABEL) as VatMode[]).map((v) => <option key={v} value={v}>{VAT_LABEL[v]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numField('monthly_fee', 'תשלום חודשי קבוע', '₪')}
                {numField('hourly_rate', 'שכר שעתי', '₪')}
                {form.department !== 'freelancer' && numField('commission_pct', 'עמלה על כל עסקה', '%')}
              </div>

              {form.department === 'sales' && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3 space-y-3">
                  <p className="text-xs text-sky-300 font-semibold">היררכיית צוות (אופציונלי)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium">מנהל הצוות שלו</label>
                      <select
                        value={form.manager_id || ''}
                        onChange={(ev) => setForm({ ...form, manager_id: ev.target.value || null })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                      >
                        <option value="">ללא מנהל</option>
                        {salesPeople.filter((s) => s.id !== form.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    {numField('override_pct', 'אחוז שהוא מקבל מהנציגים שתחתיו', '%')}
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    דוגמה: אלעד מנהל ומוגדר עם 3%. דנה מוגדרת כ"תחת אלעד" עם עמלה 10%. על כל עסקה של דנה — דנה מקבלת 10% ואלעד מקבל עוד 3%, בנוסף לעמלה על העסקאות שלו עצמו.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-zinc-800">
              <button type="submit" className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold py-2.5 rounded-xl text-sm cursor-pointer">
                {form.id ? 'שמור שינויים' : 'הוסף'}
              </button>
              <button type="button" onClick={() => setForm(null)} className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-400 py-2.5 rounded-xl text-sm cursor-pointer">
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
