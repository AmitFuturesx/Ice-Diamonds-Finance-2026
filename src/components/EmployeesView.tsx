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
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'שולם חלקית'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-600 border-rose-200';
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
        className={`${width} bg-white border border-line rounded-lg px-2 py-1.5 text-sm text-ink font-mono outline-none focus:border-navy`}
      />
    );
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    await onSaveEmployee({ ...form, name: form.name.trim(), manager_id: form.department === 'sales' ? form.manager_id : null });
    setForm(null);
  };

  // Deletion goes through the app's undo toast (6s to cancel), so no confirm dialog
  const removeEmployee = (emp: Employee) => onDeleteEmployee(emp.id);

  const isFreelancer = dept === 'freelancer';
  const numField = (key: keyof Employee, label: string, suffix: string) => (
    <div className="space-y-1">
      <label className="text-xs text-slate-500 font-medium">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="any"
          value={(form?.[key] as number) || ''}
          placeholder="0"
          onChange={(ev) => setForm((f) => (f ? { ...f, [key]: Number(ev.target.value) || 0 } : f))}
          className="w-full bg-slate-50 border border-line rounded-xl px-3 py-2.5 text-sm text-ink font-mono outline-none focus:border-navy"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-card p-6 rounded-[1.6rem]">
        <h2 className="text-xl font-bold text-ink">ניהול עובדים ושכר</h2>
        <p className="text-sm text-slate-500 mt-1">פרילנסרים, אנשי מכירות ועובדים נוספים — כמה מגיע לכל אחד החודש וכמה נשאר לשלם</p>
      </div>

      {/* Payroll totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white shadow-card rounded-[1.6rem] p-4">
          <span className="text-xs text-slate-500 block mb-1">סה״כ שכר החודש</span>
          <span className="text-xl font-black font-mono text-ink">{ils(totalOwed)}</span>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <span className="text-xs text-slate-500 block mb-1">נותר לשלם</span>
          <span className="text-xl font-black font-mono text-rose-600">{ils(totalOwed - totalPaid)}</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <span className="text-xs text-slate-500 block mb-1">כבר שולם</span>
          <span className="text-xl font-black font-mono text-emerald-600">{ils(totalPaid)}</span>
        </div>
        <div className="bg-white shadow-card rounded-[1.6rem] p-4">
          <span className="text-xs text-slate-500 block mb-1">מתוכו מע״מ ({Math.round(VAT_RATE * 100)}%)</span>
          <span className="text-xl font-black font-mono text-amber-700">{ils(totalVat)}</span>
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
              className={`text-right p-3 sm:p-4 rounded-[1.6rem] border transition-all cursor-pointer ${ active ? 'border-emerald-400 bg-emerald-50' : 'border-line bg-white shadow-card hover:border-slate-300' }`}
            >
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-ink">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span className="truncate">{d.label}</span>
                <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 rounded-full">
                  {employees.filter((e) => e.department === d.key).length}
                </span>
              </div>
              <span className="text-sm sm:text-lg font-black font-mono text-ink block mt-1">{ils(deptTotal(d.key))}</span>
            </button>
          );
        })}
      </div>

      {/* Department table */}
      <div className="bg-white shadow-card rounded-[1.6rem] overflow-hidden ">
        <div className="p-4 bg-slate-50 border-b border-line flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-ink">{DEPARTMENTS.find((d) => d.key === dept)?.label}</span>
          <button
            onClick={() => setForm(emptyEmployee(dept))}
            className="flex items-center gap-1.5 bg-navy hover:bg-navy-2 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            הוסף {dept === 'sales' ? 'נציג' : dept === 'freelancer' ? 'פרילנסר' : 'עובד'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-line text-xs text-slate-500 bg-slate-50/60">
                <th className="p-3 font-semibold">שם</th>
                {!isFreelancer && <th className="p-3 font-semibold">שעות החודש</th>}
                {!isFreelancer && <th className="p-3 font-semibold">עסקאות</th>}
                {!isFreelancer && <th className="p-3 font-semibold">סכום לעסקה (₪)</th>}
                <th className="p-3 font-semibold">פירוט התשלום</th>
                <th className="p-3 font-semibold">מע״מ</th>
                <th className="p-3 font-semibold">לתשלום</th>
                <th className="p-3 font-semibold text-center">סטטוס</th>
                <th className="p-3 font-semibold text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm text-ink-2">
              {deptRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">עוד אין אנשים במחלקה הזו — לחץ "הוסף" למעלה.</td>
                </tr>
              ) : (
                deptRows.map(({ emp, month, pay, status }) => {
                  const manager = employees.find((x) => x.id === emp.manager_id);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 align-top">
                      <td className="p-3">
                        <div className="font-semibold text-ink">{emp.name}</div>
                        <div className="text-xs text-slate-500">
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
                      <td className="p-3 text-xs text-slate-500 space-y-0.5 whitespace-nowrap">
                        {pay.fixedPay > 0 && <div>קבוע: {ils(pay.fixedPay)}</div>}
                        {emp.hourly_rate > 0 && <div>שעתי: {ils(pay.hourlyPay)} <span className="text-slate-400">({emp.hourly_rate} ₪/ש׳)</span></div>}
                        {emp.commission_pct > 0 && (
                          <div>
                            עמלה {emp.commission_pct}%: {ils(pay.ownCommission)}{' '}
                            <span className="text-slate-400">
                              ({month?.deals_count || 0} × {(Number(month?.deals_amount) || 0).toLocaleString('he-IL')} ₪)
                            </span>
                          </div>
                        )}
                        {emp.override_pct > 0 && <div className="text-sky-700">מהצוות {emp.override_pct}%: {ils(pay.overridePay)}</div>}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        <div className={emp.vat_mode === 'plus_vat' ? 'text-amber-700' : 'text-slate-500'}>{VAT_LABEL[emp.vat_mode]}</div>
                        {pay.vat > 0 && <div className="font-mono text-amber-700">+{ils(pay.vat)}</div>}
                      </td>
                      <td className="p-3 font-mono font-black text-ink whitespace-nowrap">{ils(pay.total)}</td>
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
                          <button onClick={() => setForm({ ...emp })} className="p-1.5 hover:bg-slate-100 hover:text-navy text-slate-500 rounded" title="עריכת הגדרות">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeEmployee(emp)} className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded" title="מחק">
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
          <p className="px-4 py-3 text-[11px] text-slate-500 border-t border-line">
            ממלאים שעות, כמות עסקאות וסכום לכל עסקה לחודש הנבחר — זה נשמר אוטומטית כשיוצאים מהשדה. העמלה = כמות עסקאות × סכום לעסקה × אחוז העמלה (אם העסקאות במחירים שונים, הזן ממוצע).
          </p>
        )}
      </div>

      {/* Add / edit employee modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setForm(null)}></div>
          <form onSubmit={submitForm} className="relative bg-white shadow-card rounded-[1.6rem] w-full max-w-lg max-h-[90vh] overflow-y-auto ">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="text-base font-bold text-ink">{form.id ? `עריכת ${form.name}` : 'הוספת איש צוות'}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-2 text-slate-500 hover:text-ink rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">שם *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(ev) => setForm({ ...form, name: ev.target.value })}
                    className="w-full bg-slate-50 border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-navy"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">תפקיד</label>
                  <input
                    value={form.role}
                    placeholder={DEPARTMENTS.find((d) => d.key === form.department)?.roleHint}
                    onChange={(ev) => setForm({ ...form, role: ev.target.value })}
                    className="w-full bg-slate-50 border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-navy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">מחלקה</label>
                  <select
                    value={form.department}
                    onChange={(ev) => setForm({ ...form, department: ev.target.value as Department })}
                    className="w-full bg-slate-50 border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-navy"
                  >
                    {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">מע״מ</label>
                  <select
                    value={form.vat_mode}
                    onChange={(ev) => setForm({ ...form, vat_mode: ev.target.value as VatMode })}
                    className="w-full bg-slate-50 border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-navy"
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
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-3">
                  <p className="text-xs text-sky-700 font-semibold">היררכיית צוות (אופציונלי)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-medium">מנהל הצוות שלו</label>
                      <select
                        value={form.manager_id || ''}
                        onChange={(ev) => setForm({ ...form, manager_id: ev.target.value || null })}
                        className="w-full bg-slate-50 border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-navy"
                      >
                        <option value="">ללא מנהל</option>
                        {salesPeople.filter((s) => s.id !== form.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    {numField('override_pct', 'אחוז שהוא מקבל מהנציגים שתחתיו', '%')}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    דוגמה: אלעד מנהל ומוגדר עם 3%. נציג מוגדר כ"תחת אלעד" עם עמלה 10%. על כל עסקה של הנציג — הנציג מקבל 10% ואלעד מקבל עוד 3%, בנוסף לעמלה על העסקאות שלו עצמו.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-line">
              <button type="submit" className="flex-1 bg-navy hover:bg-navy-2 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer">
                {form.id ? 'שמור שינויים' : 'הוסף'}
              </button>
              <button type="button" onClick={() => setForm(null)} className="flex-1 bg-slate-50 border border-line text-slate-500 py-2.5 rounded-xl text-sm cursor-pointer">
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
