import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  Month, 
  FixedExpense, 
  VariableExpense, 
  Debt, 
  IncomeEntry, 
  Delivery,
  PaymentStatus,
  IncomeSource,
  Employee,
  EmployeeMonth,
  DailyOrders
} from './types';
import { dbService, isLiveSupabase } from './lib/supabase';
import { exportMonthToExcel } from './lib/exportMonth';
import { computePay, VAT_RATE } from './lib/payroll';
import LoginView from './components/LoginView';
import BrandLogo from './components/BrandLogo';
import OrbitDashboard from './orbit/Dashboard';
import OIcon from './orbit/Icon';
import { PageHead, Select as OSelect } from './orbit/kit';
import OExpenses from './orbit/pages/Expenses';
import ODebts from './orbit/pages/Debts';
import OIncome from './orbit/pages/Income';
import ODeliveries from './orbit/pages/Deliveries';
import OEmployees from './orbit/pages/Employees';
import OInvoices from './orbit/pages/Invoices';
import CommandPalette, { PaletteItem } from './components/CommandPalette';
import { useToasts, ToastViewport } from './components/Toasts';

import { 
  Diamond, 
  LayoutDashboard, 
  Calendar, 
  Activity, 
  LogOut, 
  User, 
  Plus,
  Coins, 
  Truck, Upload, 
  CreditCard, 
  FileText, 
  Flame, 
  Sparkles,
  Menu,
  X,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Search,
  PanelRightClose,
  CalendarDays
} from 'lucide-react';

// Undo window before a delete is actually sent to the database
const UNDO_MS = 6000;

type ActivePage = 'dashboard' | 'fixed_expenses' | 'variable_expenses' | 'debts' | 'income' | 'deliveries' | 'employees' | 'invoices';

// Hebrew month names, indexed by month number - 1
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// Year options: from the current year and 100 years forward (fully future-proof)
const YEAR_OPTIONS = Array.from({ length: 101 }, (_, i) => new Date().getFullYear() + i);

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // One-time overdue-payment toast (vendors marked 😐/😠 and still unpaid)
  const [payNotif, setPayNotif] = useState<{ name: string; amount: number; mood: string }[] | null>(null);
  const payNotifShown = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Collapsible desktop sidebar, remembered per browser (storage may be blocked — never crash on it)
  const [sideCollapsed, setSideCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ice_side_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  // Month select parameters
  const [months, setMonths] = useState<Month[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string>('');
  const [isLoadingMonths, setIsLoadingMonths] = useState(true);
  const [isAddingMonthModal, setIsAddingMonthModal] = useState(false);
  const [newMonthYear, setNewMonthYear] = useState<number>(new Date().getFullYear());
  const [newMonthNumber, setNewMonthNumber] = useState<number>(new Date().getMonth() + 1);
  const [isCreatingMonth, setIsCreatingMonth] = useState(false);

  // Content state for active month
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeMonths, setEmployeeMonths] = useState<EmployeeMonth[]>([]);
  const [dailyOrders, setDailyOrders] = useState<DailyOrders[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Authentication check on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const u = await dbService.getCurrentUser();
        if (u) {
          setCurrentUser(u);
        }
      } catch (err) {
        console.error('Session check failed', err);
      } finally {
        setAuthChecking(false);
      }
    };
    checkSession();
  }, []);

  // Fetch Months list on mount/auth change
  useEffect(() => {
    if (!currentUser) return;
    const loadMonths = async () => {
      setIsLoadingMonths(true);
      try {
        const list = await dbService.getMonths();
        setMonths(list);
        if (list.length > 0) {
          // Open on the CURRENT real-world month if it exists; otherwise the most
          // recent month available (so we never default to an old month like March).
          const now = new Date();
          const cy = now.getFullYear();
          const cm = now.getMonth() + 1;
          const current = list.find((m) => m.year === cy && m.month_number === cm);
          const latest = [...list].sort((a, b) => b.year - a.year || b.month_number - a.month_number)[0];
          setActiveMonthId((current || latest || list[0]).id);
        }
      } catch (err) {
        console.error('Error loading months', err);
      } finally {
        setIsLoadingMonths(false);
      }
    };
    loadMonths();
  }, [currentUser]);

  // Fetch month data when month selection changes
  useEffect(() => {
    if (!currentUser || !activeMonthId) return;
    const loadAllMonthData = async () => {
      setIsLoadingData(true);
      try {
        const [fixed, variable, debtItems, incomeItems, deliveryItems] = await Promise.all([
          dbService.getFixedExpenses(activeMonthId),
          dbService.getVariableExpenses(activeMonthId),
          dbService.getDebts(activeMonthId),
          dbService.getIncomeEntries(activeMonthId),
          dbService.getDeliveries(activeMonthId)
        ]);

        setFixedExpenses(fixed);
        setVariableExpenses(variable);
        setDebts(debtItems);
        setIncomeEntries(incomeItems);
        setDeliveries(deliveryItems);
      } catch (err) {
        console.error('Error fetching details for month: ', activeMonthId, err);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadAllMonthData();
  }, [currentUser, activeMonthId]);

  // Payroll loads separately so a payroll problem never blocks the finance data
  useEffect(() => {
    if (!currentUser) return;
    dbService.getEmployees().then(setEmployees).catch((err) => console.error('Error loading employees', err));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !activeMonthId) return;
    dbService
      .getEmployeeMonths(activeMonthId)
      .then(setEmployeeMonths)
      .catch((err) => console.error('Error loading payroll month', err));
  }, [currentUser, activeMonthId]);

  // Daily orders load on their own too: a missing table never blocks the month
  useEffect(() => {
    if (!currentUser || !activeMonthId) return;
    setDailyOrders([]);
    dbService
      .getDailyOrders(activeMonthId)
      .then(setDailyOrders)
      .catch((err) => console.error('Error loading daily orders', err));
  }, [currentUser, activeMonthId]);

  // Show the overdue-payment toast once per app load, when data first reveals
  // vendors marked "commented" (😐) or "demanding" (😠) that are still unpaid.
  useEffect(() => {
    if (payNotifShown.current) return;
    const items = [
      ...[...fixedExpenses, ...variableExpenses].map((e) => ({ name: e.name, amount: Number(e.amount) || 0, status: e.status, mood: e.mood })),
      ...debts.map((d) => ({ name: d.name, amount: Number(d.monthly_payment) || 0, status: d.status || 'לא שולם', mood: d.mood }))
    ]
      .filter((e) => e.status !== 'שולם' && (e.mood === 'angry' || e.mood === 'neutral'))
      .map((e) => ({ name: e.name, amount: e.amount, mood: e.mood || '' }));
    if (items.length > 0) {
      setPayNotif(items);
      payNotifShown.current = true;
    }
  }, [fixedExpenses, variableExpenses, debts]);

  // Export the active month's full status as a multi-sheet Excel report
  const handleExportMonth = async () => {
    const m = months.find((x) => x.id === activeMonthId);
    if (!m) return;
    // Some month names already include the year ("מרץ 2026") — don't repeat it
    const monthLabel = m.name.includes(String(m.year)) ? m.name : `${m.name} ${m.year}`;
    setIsExporting(true);
    try {
      await exportMonthToExcel({
        monthLabel,
        fixedExpenses,
        variableExpenses,
        debts,
        incomeEntries,
        deliveries
      });
    } catch (err) {
      console.error(err);
      alert('שגיאה ביצירת קובץ האקסל');
    } finally {
      setIsExporting(false);
    }
  };

  // Logout trigger
  const handleLogout = async () => {
    await dbService.logout();
    setCurrentUser(null);
  };

  // Add a new month via the month + year picker.
  // Fixed expenses carry over (with their amounts, reset to "לא שולם");
  // variable expenses start empty so each month is filled in fresh.
  const handleAddMonthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate month/year entries
    if (months.some(m => m.year === newMonthYear && m.month_number === newMonthNumber)) {
      alert('החודש הזה כבר קיים ברשימה');
      return;
    }

    setIsCreatingMonth(true);
    try {
      const monthName = HEBREW_MONTHS[newMonthNumber - 1];
      const added = await dbService.addMonth(monthName, newMonthYear, newMonthNumber);

      // Build the template from the "fullest" existing month — the one with the
      // most line items — so a new month always inherits the complete list,
      // regardless of which month is currently selected. Fetched fresh from the DB.
      let srcFixed = fixedExpenses;
      let srcVariable = variableExpenses;
      // Debts carry forward from the PREVIOUS month with a "smart" balance reduction
      let srcDebts: Debt[] = [];
      try {
        const [fixedByMonth, variableByMonth, debtsByMonth] = await Promise.all([
          Promise.all(months.map(m => dbService.getFixedExpenses(m.id))),
          Promise.all(months.map(m => dbService.getVariableExpenses(m.id))),
          Promise.all(months.map(m => dbService.getDebts(m.id)))
        ]);
        // Pick the month that has the most items for each category
        srcFixed = fixedByMonth.reduce((best, cur) => (cur.length > best.length ? cur : best), [] as typeof srcFixed);
        srcVariable = variableByMonth.reduce((best, cur) => (cur.length > best.length ? cur : best), [] as typeof srcVariable);

        // For debts, use the closest EARLIER month that has debts, so the balance
        // reduction chains month-by-month (June -> July -> ...).
        const newOrdinal = newMonthYear * 12 + newMonthNumber;
        let bestOrd = -1;
        months.forEach((m, i) => {
          const ord = m.year * 12 + m.month_number;
          if (ord < newOrdinal && debtsByMonth[i].length > 0 && ord > bestOrd) {
            bestOrd = ord;
            srcDebts = debtsByMonth[i];
          }
        });
      } catch {
        // Fall back to whatever is in state if the fresh fetch fails
      }

      // Carry the fixed expenses over (amounts kept — they are recurring/constant)
      await Promise.all(
        srcFixed.map(fe =>
          dbService.saveFixedExpense({
            month_id: added.id,
            name: fe.name,
            amount: fe.amount,
            notes: fe.notes,
            status: 'לא שולם',
            payment_date: fe.payment_date
          })
        )
      );

      // Carry the variable expenses as a template: keep name, billing day and
      // notes, but ZERO the amount so it's filled in fresh each month.
      await Promise.all(
        srcVariable.map(ve =>
          dbService.saveVariableExpense({
            month_id: added.id,
            name: ve.name,
            amount: 0,
            notes: ve.notes,
            date: ve.date,
            status: 'לא שולם'
          })
        )
      );

      // Carry debts forward with the smart reduction: new balance = previous
      // balance minus the monthly payment (floored at 0). Original principal,
      // monthly payment and billing day stay the same; status resets to unpaid.
      await Promise.all(
        srcDebts.map(d => {
          const reducedBalance = Math.max(
            0,
            (Number(d.current_balance) || 0) - (Number(d.monthly_payment) || 0)
          );
          return dbService.saveDebt({
            month_id: added.id,
            name: d.name,
            monthly_payment: Number(d.monthly_payment) || 0,
            current_balance: reducedBalance,
            original_amount: Number(d.original_amount) || 0,
            payment_date: d.payment_date,
            status: 'לא שולם'
          });
        })
      );

      setMonths(prev => [...prev, added]);
      setActiveMonthId(added.id);
      setIsAddingMonthModal(false);
    } catch (err) {
      console.error(err);
      alert('שגיאה ביצירת חודש פעילות');
    } finally {
      setIsCreatingMonth(false);
    }
  };

  // ---------- Delete with undo ----------
  // The row disappears at once; the real delete is sent only after UNDO_MS.
  // "בטל" in the toast puts the row back and nothing is deleted.
  const activeMonthRef = useRef(activeMonthId);
  activeMonthRef.current = activeMonthId;

  function scheduleDelete<T extends { id: string }>(opts: {
    label: string;
    list: T[];
    id: string;
    setList: React.Dispatch<React.SetStateAction<T[]>>;
    commit: () => Promise<void>;
    monthScoped?: boolean; // restore only while the same month is still open
    afterCommit?: () => void;
  }) {
    const at = opts.list.findIndex((x) => x.id === opts.id);
    const item = opts.list[at];
    if (!item) return;
    const monthAtDelete = activeMonthRef.current;

    opts.setList((prev) => prev.filter((x) => x.id !== opts.id));

    const restore = () => {
      // After a month switch the list holds another month's rows; the item
      // was never deleted from the database, so it is simply there next time.
      if (opts.monthScoped && activeMonthRef.current !== monthAtDelete) return;
      opts.setList((prev) => (prev.some((x) => x.id === opts.id) ? prev : [...prev.slice(0, at), item, ...prev.slice(at)]));
    };

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await opts.commit();
        opts.afterCommit?.();
      } catch (err) {
        console.error(err);
        restore();
        pushToast(`המחיקה של "${opts.label}" נכשלה — השורה הוחזרה`, { tone: 'error', duration: 6000 });
      }
    }, UNDO_MS);

    pushToast(`"${opts.label}" נמחק`, {
      duration: UNDO_MS,
      action: {
        label: 'בטל',
        run: () => {
          undone = true;
          clearTimeout(timer);
          restore();
        }
      }
    });
  }

  // Content Actions (Fixed Expenses)
  const handleSaveFixedExpense = async (item: Omit<FixedExpense, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveFixedExpense(item);
      setFixedExpenses(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        } else {
          return [...prev, saved];
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFixedExpense = async (id: string) => {
    scheduleDelete({
      label: fixedExpenses.find((x) => x.id === id)?.name || 'הוצאה',
      list: fixedExpenses,
      id,
      setList: setFixedExpenses,
      commit: () => dbService.deleteFixedExpense(id),
      monthScoped: true
    });
  };

  // Content Actions (Variable Expenses)
  const handleSaveVariableExpense = async (item: Omit<VariableExpense, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveVariableExpense(item);
      setVariableExpenses(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        } else {
          return [...prev, saved];
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVariableExpense = async (id: string) => {
    scheduleDelete({
      label: variableExpenses.find((x) => x.id === id)?.name || 'הוצאה',
      list: variableExpenses,
      id,
      setList: setVariableExpenses,
      commit: () => dbService.deleteVariableExpense(id),
      monthScoped: true
    });
  };

  // Content Actions (Debts)
  const handleSaveDebt = async (item: Omit<Debt, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveDebt(item);
      setDebts(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        } else {
          return [...prev, saved];
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDebt = async (id: string) => {
    scheduleDelete({
      label: debts.find((x) => x.id === id)?.name || 'חוב',
      list: debts,
      id,
      setList: setDebts,
      commit: () => dbService.deleteDebt(id),
      monthScoped: true
    });
  };

  // Content Actions (Income)
  const handleSaveIncomeEntry = async (item: Omit<IncomeEntry, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveIncomeEntry(item);
      setIncomeEntries(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        } else {
          return [...prev, saved];
        }
      });
      return true;
    } catch (err) {
      console.error(err);
      pushToast('שמירת ההכנסה נכשלה, נסה שוב', { tone: 'error', duration: 6000 });
      return false;
    }
  };

  const handleSaveDailyOrders = async (row: { month_id: string; date: string; orders: number }) => {
    try {
      const saved = await dbService.saveDailyOrders(row);
      setDailyOrders((prev) => (prev.some((d) => d.date === saved.date) ? prev.map((d) => (d.date === saved.date ? saved : d)) : [...prev, saved]));
      return true;
    } catch (err) {
      console.error(err);
      pushToast('שמירת מספר ההזמנות נכשלה. צריך להריץ את פקודת ה-SQL של ההזמנות היומיות.', { tone: 'error', duration: 8000 });
      return false;
    }
  };

  const handleDeleteIncomeEntry = async (id: string) => {
    const entry = incomeEntries.find((x) => x.id === id);
    scheduleDelete({
      label: entry ? `הכנסה ${entry.source}` : 'הכנסה',
      list: incomeEntries,
      id,
      setList: setIncomeEntries,
      commit: () => dbService.deleteIncomeEntry(id),
      monthScoped: true
    });
  };

  // Content Actions (Deliveries)
  const handleSaveDelivery = async (item: Omit<Delivery, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveDelivery(item);
      setDeliveries(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        } else {
          return [...prev, saved];
        }
      });
    } catch (err) {
      console.error(err);
      const msg = String((err as { message?: string })?.message || '');
      const missingDay = 'payment_day' in item && /payment_day/i.test(msg);
      const missingStatus = 'status' in item && /status/i.test(msg);
      pushToast(
        missingDay
          ? 'קביעת יום תשלום לשליחויות דורשת הרצת פקודת SQL קצרה (payment_day) ב-Supabase'
          : missingStatus
            ? 'סימון תשלום לשליחויות דורש הרצת פקודת SQL קצרה (deliveries_status) ב-Supabase'
            : 'שמירת השליחות נכשלה, נסה שוב',
        { tone: 'error', duration: 8000 }
      );
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    const del = deliveries.find((x) => x.id === id);
    scheduleDelete({
      label: del ? `שליחות ${del.route_from} ← ${del.route_to}` : 'שליחות',
      list: deliveries,
      id,
      setList: setDeliveries,
      commit: () => dbService.deleteDelivery(id),
      monthScoped: true
    });
  };

  // Content Actions (Employees / payroll) — failures are shown, not swallowed
  const handleSaveEmployee = async (item: Omit<Employee, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveEmployee(item);
      setEmployees(prev => (prev.some(p => p.id === saved.id) ? prev.map(p => (p.id === saved.id ? saved : p)) : [...prev, saved]));
    } catch (err) {
      console.error(err);
      const missingDay = 'payment_day' in item && /payment_day/i.test(String((err as { message?: string })?.message || ''));
      pushToast(missingDay ? 'קביעת יום תשלום לעובדים דורשת הרצת פקודת SQL קצרה (payment_day) ב-Supabase' : 'שמירת העובד נכשלה, נסה שוב', { tone: 'error', duration: 8000 });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    // Employees are not month-scoped, so undo always restores. Their monthly rows
    // stay in state untouched until the delete is committed (DB cascades them).
    scheduleDelete({
      label: employees.find((x) => x.id === id)?.name || 'עובד',
      list: employees,
      id,
      setList: setEmployees,
      commit: () => dbService.deleteEmployee(id),
      afterCommit: () => {
        // mirror the DB: ON DELETE SET NULL for reps under this manager, cascade for month rows
        setEmployees((prev) => prev.map((e) => (e.manager_id === id ? { ...e, manager_id: null } : e)));
        setEmployeeMonths((prev) => prev.filter((m) => m.employee_id !== id));
      }
    });
  };

  const handleSaveEmployeeMonth = async (row: Omit<EmployeeMonth, 'id'> & { id?: string }) => {
    try {
      const saved = await dbService.saveEmployeeMonth(row);
      setEmployeeMonths(prev =>
        prev.some(m => m.employee_id === saved.employee_id)
          ? prev.map(m => (m.employee_id === saved.employee_id ? saved : m))
          : [...prev, saved]
      );
    } catch (err) {
      console.error(err);
      alert('שמירת נתוני החודש נכשלה.');
    }
  };

  const activeMonthObject = months.find(m => m.id === activeMonthId);
  const activeMonthName = activeMonthObject ? `${activeMonthObject.name} ${activeMonthObject.year}` : 'טוען...';

  // Navigation schema (grouped like a SaaS sidebar)
  const navItems = [
    { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard, oicon: 'dashboard', group: 'ראשי', desc: 'תמונת מצב של החודש: מאזן, תשלומים, חובות ושכר' },
    { id: 'income', label: 'הכנסות', icon: Coins, oicon: 'coins', group: 'כספים', desc: 'כל ההכנסות של החודש לפי מקור' },
    { id: 'fixed_expenses', label: 'הוצאות קבועות', icon: FileText, oicon: 'receipt', group: 'כספים', desc: 'תשלומים קבועים שחוזרים כל חודש' },
    { id: 'variable_expenses', label: 'הוצאות משתנות', icon: CreditCard, oicon: 'card', group: 'כספים', desc: 'רכש, ספקים ותשלומים משתנים' },
    { id: 'debts', label: 'חובות והלוואות', icon: Landmark, oicon: 'bank', group: 'כספים', desc: 'הלוואות, יתרות וכמה תשלומים נותרו' },
    { id: 'deliveries', label: 'שליחויות', icon: Truck, oicon: 'truck', group: 'כספים', desc: 'משלוחים והפצה, נטו וכולל מע״מ' },
    { id: 'invoices', label: 'חשבוניות', icon: Upload, oicon: 'upload', group: 'כספים', desc: 'העלאת חשבוניות וקבלות ישר למורנינג' },
    { id: 'employees', label: 'עובדים ושכר', icon: User, oicon: 'users', group: 'צוות', desc: 'שכר, עמלות וסטטוס תשלום לכל איש צוות' },
  ];
  const navGroups = ['ראשי', 'כספים', 'צוות'];

  // Paid vs. still open this month — same five groups as the dashboard blocks
  // (fixed, variable, debt installments, payroll, deliveries incl. VAT) — sidebar card + badges
  const unpaidOf = (list: { status?: string }[]) => list.filter((x) => (x.status || 'לא שולם') !== 'שולם').length;
  const empMonthMap: Record<string, EmployeeMonth> = {};
  employeeMonths.forEach((m) => (empMonthMap[m.employee_id] = m));
  const owedRows: { amount: number; paid: boolean }[] = [
    ...fixedExpenses.map((e) => ({ amount: Number(e.amount) || 0, paid: e.status === 'שולם' })),
    ...variableExpenses.map((e) => ({ amount: Number(e.amount) || 0, paid: e.status === 'שולם' })),
    ...debts.map((d) => ({ amount: Number(d.monthly_payment) || 0, paid: d.status === 'שולם' })),
    ...employees
      .filter((e) => e.active !== false)
      .map((e) => ({ amount: computePay(e, empMonthMap[e.id], employees, empMonthMap).total, paid: empMonthMap[e.id]?.status === 'שולם' })),
    ...deliveries.map((d) => ({ amount: (Number(d.price) || 0) * (1 + VAT_RATE), paid: d.status === 'שולם' }))
  ];
  const owedAll = owedRows.reduce((a, r) => a + r.amount, 0);
  const paidAll = owedRows.filter((r) => r.paid).reduce((a, r) => a + r.amount, 0);
  const leftAll = owedAll - paidAll;
  const paidPctAll = owedAll > 0 ? Math.round((paidAll / owedAll) * 100) : 0;
  const navBadges: Record<string, { n: number; hot?: boolean } | undefined> = {
    fixed_expenses: unpaidOf(fixedExpenses) ? { n: unpaidOf(fixedExpenses) } : undefined,
    variable_expenses: unpaidOf(variableExpenses) ? { n: unpaidOf(variableExpenses) } : undefined,
    debts: unpaidOf(debts) ? { n: unpaidOf(debts), hot: debts.some((d) => d.mood === 'angry' && d.status !== 'שולם') } : undefined,
    employees: employees.length ? { n: employees.length } : undefined
  };
  const currentNav = navItems.find((n) => n.id === activePage) || navItems[0];

  // Ctrl+K / ⌘K opens the command palette from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Remember the sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('ice_side_collapsed', sideCollapsed ? '1' : '0');
    } catch {
      /* storage blocked — the toggle still works for this visit */
    }
  }, [sideCollapsed]);

  // White pill that slides behind the active sidebar item (Orbit)
  const navRef = useRef<HTMLElement | null>(null);
  const navPillRef = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const item = navRef.current?.querySelector<HTMLElement>(`[data-nav="${activePage}"]`);
    const pill = navPillRef.current;
    if (!pill) return;
    if (!item) {
      pill.style.opacity = '0';
      return;
    }
    pill.style.opacity = '1';
    pill.style.transform = `translateY(${item.offsetTop}px)`;
    pill.style.height = `${item.offsetHeight}px`;
  }, [activePage, sideCollapsed, currentUser, authChecking, isLoadingMonths]);
  // What every inner page needs to know about the open month (header month picker + toasts)
  const pageMonth = {
    activeMonthId,
    monthYear: activeMonthObject?.year,
    monthNumber: activeMonthObject?.month_number,
    months,
    onChangeMonth: setActiveMonthId,
    onAddMonth: () => setIsAddingMonthModal(true),
    notify: pushToast
  };
  const monthOptions = [...months]
    .sort((a, b) => b.year - a.year || b.month_number - a.month_number)
    .map((m) => ({ id: m.id, label: m.name.includes(String(m.year)) ? m.name : `${m.name} ${m.year}` }));

  // Everything the palette can jump to: pages, months, actions, and this month's records
  const goTo = (page: ActivePage) => {
    setActivePage(page);
    setMobileNavOpen(false);
  };
  const ils0 = (n: number) => n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
  const paletteItems: PaletteItem[] = [
    ...navItems.map((n) => ({ id: `page-${n.id}`, label: n.label, sub: n.desc, group: 'מעבר לעמוד', icon: n.icon, run: () => goTo(n.id as ActivePage) })),
    { id: 'act-add-month', label: 'הוספת חודש חדש', group: 'פעולות מהירות', icon: Plus, run: () => setIsAddingMonthModal(true) },
    { id: 'act-export', label: 'ייצוא החודש לאקסל', sub: activeMonthName, group: 'פעולות מהירות', icon: Download, run: () => handleExportMonth() },
    ...[...months]
      .sort((a, b) => b.year - a.year || b.month_number - a.month_number)
      .map((m) => ({
        id: `month-${m.id}`,
        label: m.name.includes(String(m.year)) ? m.name : `${m.name} ${m.year}`,
        sub: m.id === activeMonthId ? 'החודש הפתוח כרגע' : 'מעבר לחודש',
        group: 'חודשים',
        icon: CalendarDays,
        run: () => setActiveMonthId(m.id)
      })),
    ...fixedExpenses.map((e) => ({ id: `fe-${e.id}`, label: e.name, sub: `הוצאה קבועה · ${ils0(Number(e.amount) || 0)} · ${e.status}`, group: 'ברשומות החודש', icon: FileText, run: () => goTo('fixed_expenses') })),
    ...variableExpenses.map((e) => ({ id: `ve-${e.id}`, label: e.name, sub: `הוצאה משתנה · ${ils0(Number(e.amount) || 0)} · ${e.status}`, group: 'ברשומות החודש', icon: CreditCard, run: () => goTo('variable_expenses') })),
    ...debts.map((d) => ({ id: `de-${d.id}`, label: d.name, sub: `חוב · החזר ${ils0(Number(d.monthly_payment) || 0)} · יתרה ${ils0(Number(d.current_balance) || 0)}`, group: 'ברשומות החודש', icon: Landmark, run: () => goTo('debts') })),
    ...deliveries.map((d) => ({ id: `dl-${d.id}`, label: `${d.route_from} ← ${d.route_to}`, sub: `שליחות · ${ils0(Number(d.price) || 0)}`, group: 'ברשומות החודש', icon: Truck, run: () => goTo('deliveries') })),
    ...employees.map((e) => ({ id: `em-${e.id}`, label: e.name, sub: `עובד · ${e.role || ''}`, group: 'צוות', icon: User, run: () => goTo('employees') }))
  ];

  // Render check
  if (authChecking) {
    return (
      <div className="flex h-screen items-center justify-center text-muted">
        <div className="text-center space-y-4">
          <BrandLogo size={64} cutout="#e8ecf4" className="mx-auto animate-pulse" />
          <p className="text-sm font-semibold tracking-wide">טוען נתונים פיננסיים...</p>
        </div>
      </div>
    );
  }

  // If unauthorized, direct to login
  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const initials = currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'ID';
  const sortedMonths = [...months].sort((a, b) => a.year - b.year || a.month_number - b.month_number);

  return (
    <div className="app">
      {/* Frame: Orbit's green gradient that holds the sidebar and the light panel */}
      <div className={`frame ${sideCollapsed ? 'is-collapsed' : ''}`}>
        {/* ---------- Sidebar (desktop) ---------- */}
        <aside className="side" aria-label="ניווט ראשי">
          <button className="side-toggle" onClick={() => setSideCollapsed((c) => !c)} aria-label={sideCollapsed ? 'הרחבת התפריט' : 'כיווץ התפריט'}>
            <OIcon name="chevronRight" />
          </button>

          <button className="brand" onClick={() => setActivePage('dashboard')} data-tip="Ice Diamonds">
            <span className="brand-mark ice-brand-mark">
              <BrandLogo size={30} cutout="#ffffff" />
            </span>
            <span className="brand-text fade-label">
              <strong>Ice Diamonds</strong>
              <span>מערכת ניהול כספים</span>
            </span>
          </button>

          <nav className="nav" ref={navRef}>
            <span className="nav-pill" ref={navPillRef} aria-hidden="true" />
            {navGroups.map((g, gi) => (
              <div className="nav-group" key={g}>
                <p className="nav-caption" style={{ '--i': gi * 5 }}>
                  <span className="fade-label">{g}</span>
                </p>
                {navItems
                  .filter((n) => n.group === g)
                  .map((item, i) => {
                    const isActive = activePage === item.id;
                    const badge = navBadges[item.id];
                    return (
                      <button
                        id={`side-nav-${item.id}`}
                        key={item.id}
                        data-nav={item.id}
                        data-tip={item.label}
                        className={`nav-item ${isActive ? 'is-active' : ''}`}
                        style={{ '--i': gi * 5 + i + 1 }}
                        onClick={() => setActivePage(item.id as ActivePage)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <OIcon name={item.oicon} />
                        <span className="nav-label">{item.label}</span>
                        {badge ? <span className={`nav-badge ${badge.hot ? 'is-hot' : ''}`}>{badge.n}</span> : null}
                        {badge?.hot ? <i className="nav-dot" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
              </div>
            ))}
          </nav>

          <div className="side-foot" style={{ '--i': 16 }}>
            <button className="goal" onClick={() => setActivePage('dashboard')}>
              <div className="goal-top">
                <span>שולם החודש</span>
                <b>{paidPctAll}%</b>
              </div>
              <div className="goal-bar">
                <i style={{ width: `${paidPctAll}%` }} />
              </div>
              <p>
                {ils0(paidAll)} מתוך {ils0(paidAll + leftAll)}
              </p>
            </button>

            <button className="nav-item" data-tip="חיפוש מהיר" onClick={() => setPaletteOpen(true)}>
              <OIcon name="search" />
              <span className="nav-label">חיפוש מהיר</span>
              <span className="nav-badge" dir="ltr">Ctrl K</span>
            </button>
            <button className="nav-item" data-tip="יציאה" onClick={handleLogout} id="desktop-logout-btn">
              <OIcon name="logout" />
              <span className="nav-label">יציאה</span>
            </button>

            <div className="profile">
              <div className="profile-btn" data-tip={currentUser.email}>
                <span className="avatar avatar--initials profile-avatar">{initials}</span>
                <span className="profile-text">
                  <strong dir="ltr" className="ice-email">{currentUser.email}</strong>
                  <span>{isLiveSupabase ? 'מחובר ומסונכרן' : 'מצב הדגמה'}</span>
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- Light panel ---------- */}
        <div className="panel">
          {/* Mobile top bar (phones keep the hamburger menu) */}
          <div className="ice-mbar">
            <div className="ice-mbar-brand">
              <span className="ice-brand-mark">
                <BrandLogo size={26} cutout="#ffffff" />
              </span>
              <div>
                <strong>Ice Diamonds</strong>
                <span>מערכת ניהול כספים</span>
              </div>
            </div>
            <div className="ice-mbar-actions">
              <button onClick={() => setPaletteOpen(true)} aria-label="חיפוש">
                <OIcon name="search" />
              </button>
              <button id="mob-menu-toggle" onClick={() => setMobileNavOpen(true)} aria-label="תפריט">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Page — re-keyed so each page / month change plays the entrance */}
          <main key={`${activePage}-${activeMonthId}`} className="main ice-main">
            {isLoadingData ? (
              <div className="card ice-loading">
                <BrandLogo size={48} cutout="#ffffff" className="animate-pulse" />
                <p>טוען את נתוני החודש...</p>
              </div>
            ) : (
              <>
                {activePage === 'dashboard' && (
                  <OrbitDashboard
                    dailyOrders={dailyOrders}
                    onSaveIncome={handleSaveIncomeEntry}
                    onDeleteIncome={handleDeleteIncomeEntry}
                    onSaveDailyOrders={handleSaveDailyOrders}
                    fixedExpenses={fixedExpenses}
                    variableExpenses={variableExpenses}
                    debts={debts}
                    incomeEntries={incomeEntries}
                    months={months}
                    activeMonthId={activeMonthId}
                    onChangeMonth={setActiveMonthId}
                    onAddMonth={() => setIsAddingMonthModal(true)}
                    onExport={handleExportMonth}
                    exporting={isExporting}
                    onSaveFixedExpense={handleSaveFixedExpense}
                    onSaveVariableExpense={handleSaveVariableExpense}
                    onSaveDebt={handleSaveDebt}
                    deliveries={deliveries}
                    onSaveDelivery={handleSaveDelivery}
                    onSaveEmployeeMonth={handleSaveEmployeeMonth}
                    onSaveEmployee={handleSaveEmployee}
                    employees={employees}
                    employeeMonths={employeeMonths}
                    onNavigate={(p: ActivePage) => setActivePage(p)}
                    notify={pushToast}
                  />
                )}

                {activePage === 'fixed_expenses' && (
                  <OExpenses
                    kind="fixed"
                    expenses={fixedExpenses}
                    {...pageMonth}
                    onSaveExpense={handleSaveFixedExpense}
                    onDeleteExpense={handleDeleteFixedExpense}
                  />
                )}

                {activePage === 'variable_expenses' && (
                  <OExpenses
                    kind="variable"
                    expenses={variableExpenses}
                    {...pageMonth}
                    onSaveExpense={handleSaveVariableExpense}
                    onDeleteExpense={handleDeleteVariableExpense}
                  />
                )}

                {activePage === 'debts' && <ODebts debts={debts} {...pageMonth} onSaveDebt={handleSaveDebt} onDeleteDebt={handleDeleteDebt} />}

                {activePage === 'income' && (
                  <OIncome incomeEntries={incomeEntries} dailyOrders={dailyOrders} {...pageMonth} onSaveIncome={handleSaveIncomeEntry} onDeleteIncome={handleDeleteIncomeEntry} onSaveDailyOrders={handleSaveDailyOrders} />
                )}

                {activePage === 'deliveries' && (
                  <ODeliveries deliveries={deliveries} {...pageMonth} onSaveDelivery={handleSaveDelivery} onDeleteDelivery={handleDeleteDelivery} />
                )}

                {activePage === 'invoices' && (
                  <OInvoices
                    notify={pushToast}
                    userEmail={currentUser?.email}
                    {...pageMonth}
                    fixedExpenses={fixedExpenses}
                    variableExpenses={variableExpenses}
                    debts={debts}
                    deliveries={deliveries}
                    employees={employees}
                    employeeMonths={employeeMonths}
                  />
                )}

                {activePage === 'employees' && (
                  <OEmployees
                    employees={employees}
                    employeeMonths={employeeMonths}
                    {...pageMonth}
                    onSaveEmployee={handleSaveEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                    onSaveEmployeeMonth={handleSaveEmployeeMonth}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* 4. Mobile side drawer navigation (opened via hamburger) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#1c3a33]/35 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          ></div>

          {/* Drawer panel (slides in from the right for RTL) */}
          <div
            className="absolute top-0 right-0 h-full w-72 max-w-[82%] text-white flex flex-col animate-[mSlideIn_0.25s_var(--out)] rounded-l-3xl overflow-hidden"
            style={{ background: 'linear-gradient(162deg, #82ce71 0%, #67b962 30%, #58a961 58%, #4b9a71 80%, #3a7f8f 100%)' }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-20 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="ice-brand-mark"><BrandLogo size={28} cutout="#ffffff" /></span>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold leading-none">ICE DIAMONDS</span>
                  <span className="text-[10px] text-white/80 mt-1">מערכת ניהול כספים</span>
                </div>
              </div>
              <button
                id="drawer-close"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="סגור"
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items, grouped */}
            <nav className="flex-1 overflow-y-auto p-4">
              {navGroups.map((g) => (
                <div key={g} className="mb-3">
                  <div className="px-3 h-7 flex items-center text-[10.5px] font-semibold tracking-[0.14em] text-white/50">{g}</div>
                  {navItems
                    .filter((n) => n.group === g)
                    .map((item) => {
                      const Icon = item.icon;
                      const isActive = activePage === item.id;
                      return (
                        <button
                          id={`drawer-nav-${item.id}`}
                          key={item.id}
                          onClick={() => {
                            setActivePage(item.id as ActivePage);
                            setMobileNavOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 mb-0.5 rounded-2xl text-[15px] text-right transition-all cursor-pointer ${
                            isActive ? 'bg-white text-navy font-bold shadow-lg' : 'text-white/85 hover:bg-white/10 font-medium'
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-gold-2' : ''}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                </div>
              ))}
            </nav>

            {/* Drawer footer: user + logout */}
            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f6e4b0] to-gold text-navy flex items-center justify-center font-black text-xs select-none shrink-0">
                  {initials}
                </div>
                <span className="text-xs text-white/70 truncate">{currentUser?.email}</span>
              </div>
              <button
                id="drawer-logout"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-white/85 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-all cursor-pointer font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>יציאה מהחשבון</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Month Modal Popup */}
      {isAddingMonthModal && (
        <div className="fixed inset-0 bg-[#1c3a33]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="pop-in bg-white shadow-pop border border-line p-6 rounded-3xl max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold-2" />
              הוספת חודש שקיפות חדש
            </h3>
            <p className="text-xs text-slate-500 leading-snug">
              בחר חודש ושנה. ההוצאות הקבועות יועתקו אוטומטית עם הסכומים שלהן, וההוצאות המשתנות יתחילו ריקות למילוי מחדש.
            </p>

            <form onSubmit={handleAddMonthSubmit} className="space-y-4 pt-1">
              {/* Year stepper with arrows */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 font-medium">שנה</label>
                <div className="flex items-center justify-between bg-slate-100 border border-line rounded-xl px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setNewMonthYear((y) => Math.max(new Date().getFullYear(), y - 1))}
                    disabled={newMonthYear <= new Date().getFullYear()}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="שנה קודמת"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="text-lg font-black font-mono text-ink select-none">{newMonthYear}</span>
                  <button
                    type="button"
                    onClick={() => setNewMonthYear((y) => y + 1)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100 transition-colors"
                    title="שנה הבאה"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Month grid picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 font-medium">חודש</label>
                <div className="grid grid-cols-3 gap-2">
                  {HEBREW_MONTHS.map((name, idx) => {
                    const monthNum = idx + 1;
                    const isSelected = newMonthNumber === monthNum;
                    const alreadyExists = months.some(
                      (m) => m.year === newMonthYear && m.month_number === monthNum
                    );
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewMonthNumber(monthNum)}
                        disabled={alreadyExists}
                        title={alreadyExists ? 'חודש זה כבר קיים' : name}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border ${
                          isSelected
                            ? 'bg-navy text-white border-navy shadow-md shadow-navy/20'
                            : alreadyExists
                            ? 'bg-transparent text-slate-400 border-line cursor-not-allowed line-through'
                            : 'bg-slate-100 text-ink-2 border-line hover:border-navy/30 hover:text-ink cursor-pointer'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  id="submit-new-mon"
                  type="submit"
                  disabled={isCreatingMonth}
                  className="flex-1 bg-navy hover:bg-navy-2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-2.5 px-3 rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-lg shadow-navy/15 hover:scale-[1.02]"
                >
                  {isCreatingMonth ? 'יוצר חודש...' : 'הוסף חודש'}
                </button>
                <button
                  id="close-mon-modal"
                  type="button"
                  onClick={() => setIsAddingMonthModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-100 border border-line py-2.5 px-3 rounded-xl text-slate-500 text-xs text-center transition duration-200 cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ctrl+K palette and undo/status toasts */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />

      {/* Overdue-payment toast (bottom-right, once per load) */}
      {payNotif && payNotif.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)] bg-white border border-rose-200 rounded-2xl overflow-hidden animate-[mSlideIn_0.25s_ease-out]">
          <div className="flex items-start justify-between gap-3 px-4 py-3 bg-rose-50 border-b border-rose-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏰</span>
              <div>
                <div className="text-sm font-bold text-rose-600">עבר זמן התשלום!</div>
                <div className="text-[11px] text-slate-500">{payNotif.length} ספקים ממתינים לתשלום</div>
              </div>
            </div>
            <button
              onClick={() => setPayNotif(null)}
              className="p-1 text-slate-500 hover:text-ink hover:bg-slate-100 rounded-full transition-colors shrink-0"
              title="סגור"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto p-3 space-y-1.5">
            {payNotif.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none shrink-0">{v.mood === 'angry' ? '😠' : '😐'}</span>
                  <span className="text-sm text-ink truncate">{v.name}</span>
                </div>
                <span className="text-xs font-mono font-bold text-rose-600 shrink-0">
                  {v.amount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
