import React, { useState, useEffect, useRef } from 'react';
import { 
  Month, 
  FixedExpense, 
  VariableExpense, 
  Debt, 
  IncomeEntry, 
  Delivery,
  PaymentStatus,
  IncomeSource
} from './types';
import { dbService, isLiveSupabase } from './lib/supabase';
import LoginView from './components/LoginView';
import BrandLogo from './components/BrandLogo';
import DashboardView from './components/DashboardView';
import FixedExpensesView from './components/FixedExpensesView';
import VariableExpensesView from './components/VariableExpensesView';
import DebtsView from './components/DebtsView';
import IncomeView from './components/IncomeView';
import DeliveriesView from './components/DeliveriesView';

import { 
  Diamond, 
  LayoutDashboard, 
  Calendar, 
  Activity, 
  LogOut, 
  User, 
  Plus,
  Coins, 
  Truck, 
  CreditCard, 
  FileText, 
  Flame, 
  Sparkles,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark
} from 'lucide-react';

type ActivePage = 'dashboard' | 'fixed_expenses' | 'variable_expenses' | 'debts' | 'income' | 'deliveries';

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

  // Show the overdue-payment toast once per app load, when data first reveals
  // vendors marked "commented" (😐) or "demanding" (😠) that are still unpaid.
  useEffect(() => {
    if (payNotifShown.current) return;
    const items = [...fixedExpenses, ...variableExpenses]
      .filter((e) => e.status !== 'שולם' && (e.mood === 'angry' || e.mood === 'neutral'))
      .map((e) => ({ name: e.name, amount: Number(e.amount) || 0, mood: e.mood || '' }));
    if (items.length > 0) {
      setPayNotif(items);
      payNotifShown.current = true;
    }
  }, [fixedExpenses, variableExpenses]);

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
    try {
      await dbService.deleteFixedExpense(id);
      setFixedExpenses(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
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
    try {
      await dbService.deleteVariableExpense(id);
      setVariableExpenses(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
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
    try {
      await dbService.deleteDebt(id);
      setDebts(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteIncomeEntry = async (id: string) => {
    try {
      await dbService.deleteIncomeEntry(id);
      setIncomeEntries(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error(err);
    }
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
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    try {
      await dbService.deleteDelivery(id);
      setDeliveries(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Layout Dynamic Calculations (recalculates immediately on any input addition or edit)
  const totalIncomeCalc = incomeEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalExpensesCalc = 
    fixedExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) +
    variableExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) +
    debts.reduce((acc, curr) => acc + (Number(curr.monthly_payment) || 0), 0);
  const netBalanceCalc = totalIncomeCalc - totalExpensesCalc;
  const activeMonthObject = months.find(m => m.id === activeMonthId);
  const activeMonthName = activeMonthObject ? `${activeMonthObject.name} ${activeMonthObject.year}` : 'טוען...';

  // Navigation schema
  const navItems = [
    { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
    { id: 'income', label: 'הכנסות', icon: Coins },
    { id: 'fixed_expenses', label: 'הוצאות קבועות', icon: FileText },
    { id: 'variable_expenses', label: 'הוצאות משתנות', icon: CreditCard },
    { id: 'debts', label: 'חובות והלוואות', icon: Landmark },
    { id: 'deliveries', label: 'שליחויות', icon: Truck },
  ];

  // Render check
  if (authChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-zinc-400">
        <div className="text-center space-y-4">
          <Diamond className="w-10 h-10 animate-spin text-[#22c55e] mx-auto" />
          <p className="text-sm font-semibold tracking-wider font-mono">טוען נתונים פיננסיים...</p>
        </div>
      </div>
    );
  }

  // If unauthorized, direct to login
  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col font-sans antialiased text-right">
      
      {/* 1. Header (Brand, Sticky month selector, and User panel) */}
      <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-8 border-b border-white/10 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            <BrandLogo size={42} className="shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-none">ICE DIAMONDS</h1>
              <span className="text-[10px] sm:text-[11px] text-[#22c55e] font-sans tracking-wide">מערכת ניהול כספים</span>
            </div>
          </div>

          {/* Sticky month selector with options to add additional months online */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-1.5 bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-white/5 hover:border-[#22c55e]/50 transition-colors">
              <select
                id="month-selector-dropdown"
                value={activeMonthId}
                onChange={(e) => setActiveMonthId(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-white outline-none cursor-pointer appearance-none pr-1 pl-5 rtl:pl-1 rtl:pr-5 select-none"
              >
                {isLoadingMonths ? (
                  <option className="bg-[#1a1a1a]">נטען...</option>
                ) : (
                  [...months]
                    .sort((a, b) => a.year - b.year || a.month_number - b.month_number)
                    .map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#1c1c1c] text-white">
                        {m.name} {m.year}
                      </option>
                    ))
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute left-2 pointer-events-none" />
            </div>

            {/* Add Month Quick button */}
            <button
              id="trigger-add-month-modal"
              onClick={() => setIsAddingMonthModal(true)}
              className="p-1.5 bg-[#1a1a1a] hover:bg-white/5 border border-white/5 hover:border-[#22c55e]/30 rounded-full text-[#22c55e] hover:text-[#22c55e]/80 transition-all cursor-pointer flex items-center justify-center"
              title="הוסף חודש חדש"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* User information & Logout trigger */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <div className="w-9 h-9 rounded-full bg-[#22c55e] flex items-center justify-center font-black text-black text-xs select-none shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                {currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'ID'}
              </div>
              <span className="font-mono max-w-[120px] truncate block text-zinc-400" title={currentUser.email}>
                {currentUser.email}
              </span>
            </div>
            
            <button
              id="desktop-logout-btn"
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-rose-450 bg-[#1a1a1a] hover:bg-rose-950/20 border border-white/5 hover:border-rose-500/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>יציאה</span>
            </button>
          </div>

          {/* Mobile: hamburger menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              id="mob-menu-toggle"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 bg-[#1a1a1a] border border-white/5 text-[#22c55e] hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              title="תפריט"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Top Summary Strip on every page */}
      <section className="h-12 bg-[#141414] border-b border-white/5 flex items-center px-4 sm:px-8 gap-6 sm:gap-12 text-xs sm:text-sm overflow-x-auto whitespace-nowrap scrollbar-none select-none">
        <div className="max-w-7xl mx-auto w-full flex items-center gap-6 sm:gap-12">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">חודש פעיל:</span>
            <span className="font-bold text-white">{activeMonthObject ? `${activeMonthObject.name} ${activeMonthObject.year}` : 'טוען...'}</span>
          </div>

          <div className="h-4 w-px bg-white/10 shrink-0"></div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">הכנסות:</span>
            <span className="font-semibold text-[#22c55e]">₪{totalIncomeCalc.toLocaleString('he-IL')}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">הוצאות:</span>
            <span className="font-semibold text-rose-500">₪{totalExpensesCalc.toLocaleString('he-IL')}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">מאזן נטו:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-xs ${
              netBalanceCalc >= 0 ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-rose-500/20 text-rose-500'
            }`}>
              ₪{netBalanceCalc.toLocaleString('he-IL')}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Main Workspace and Navigation layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col md:flex-row gap-6">
        
        {/* Sidebar Navigation - Desktop only */}
        <aside className="w-60 shrink-0 hidden md:flex flex-col border-l border-white/10 bg-[#0d0d0d] p-4 gap-1 rounded-2xl h-fit">
          <div className="text-[10px] font-bold text-gray-500 tracking-widest font-sans uppercase pr-2 mb-3 mt-1">תפריט ניווט עסקי</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              return (
                <button
                  id={`side-nav-${item.id}`}
                  key={item.id}
                  onClick={() => setActivePage(item.id as ActivePage)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-right transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-medium' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent transition-colors'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick legal stats / app mode wrapper */}
          <div className="mt-8 pt-4 border-t border-white/5">
            <div className="bg-gradient-to-b from-[#1a1a1a] to-transparent p-4 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase text-gray-500 mb-2 font-black tracking-wider">סטטוס מערכת</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLiveSupabase ? 'bg-[#22c55e] animate-pulse' : 'bg-amber-450 animate-pulse'}`}></div>
                <span className="text-xs text-gray-300">
                  {isLiveSupabase ? 'מסונכרן עם Supabase' : 'מצב הדגמה פעיל'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Panel Workspace */}
        <main className="flex-1 min-w-0">
          {isLoadingData ? (
            <div className="bg-[#111] border border-white/10 rounded-2xl p-16 text-center space-y-4 shadow-2xl">
              <Diamond className="w-10 h-10 animate-spin text-[#22c55e] mx-auto shadow-[0_0_15px_rgba(34,197,94,0.3)]" />
              <p className="text-gray-400 text-sm font-semibold">הסינכרון הפיננסי מתבצע כעת...</p>
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView
                  fixedExpenses={fixedExpenses}
                  variableExpenses={variableExpenses}
                  debts={debts}
                  incomeEntries={incomeEntries}
                  deliveries={deliveries}
                  selectedMonthName={activeMonthName}
                  onSaveFixedExpense={handleSaveFixedExpense}
                  onSaveVariableExpense={handleSaveVariableExpense}
                />
              )}

              {activePage === 'fixed_expenses' && (
                <FixedExpensesView 
                  expenses={fixedExpenses}
                  activeMonthId={activeMonthId}
                  onSaveExpense={handleSaveFixedExpense}
                  onDeleteExpense={handleDeleteFixedExpense}
                />
              )}

              {activePage === 'variable_expenses' && (
                <VariableExpensesView
                  expenses={variableExpenses}
                  activeMonthId={activeMonthId}
                  monthYear={activeMonthObject?.year}
                  monthNumber={activeMonthObject?.month_number}
                  onSaveExpense={handleSaveVariableExpense}
                  onDeleteExpense={handleDeleteVariableExpense}
                />
              )}

              {activePage === 'debts' && (
                <DebtsView 
                  debts={debts}
                  activeMonthId={activeMonthId}
                  onSaveDebt={handleSaveDebt}
                  onDeleteDebt={handleDeleteDebt}
                />
              )}

              {activePage === 'income' && (
                <IncomeView 
                  incomeEntries={incomeEntries}
                  activeMonthId={activeMonthId}
                  onSaveIncome={handleSaveIncomeEntry}
                  onDeleteIncome={handleDeleteIncomeEntry}
                />
              )}

              {activePage === 'deliveries' && (
                <DeliveriesView 
                  deliveries={deliveries}
                  activeMonthId={activeMonthId}
                  onSaveDelivery={handleSaveDelivery}
                  onDeleteDelivery={handleDeleteDelivery}
                />
              )}
            </>
          )}
        </main>

      </div>

      {/* 4. Mobile side drawer navigation (opened via hamburger) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          ></div>

          {/* Drawer panel (slides in from the right for RTL) */}
          <div className="absolute top-0 right-0 h-full w-72 max-w-[82%] bg-[#0d0d0d] border-l border-white/10 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <BrandLogo size={34} className="shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-white leading-none">ICE DIAMONDS</span>
                  <span className="text-[10px] text-[#22c55e]">מערכת ניהול כספים</span>
                </div>
              </div>
              <button
                id="drawer-close"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                title="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {navItems.map((item) => {
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
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-right transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-semibold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Drawer footer: user + logout */}
            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-9 h-9 rounded-full bg-[#22c55e] flex items-center justify-center font-black text-black text-xs select-none shrink-0">
                  {currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'ID'}
                </div>
                <span className="font-mono text-xs text-zinc-400 truncate">{currentUser?.email}</span>
              </div>
              <button
                id="drawer-logout"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:text-rose-400 bg-[#1a1a1a] hover:bg-rose-950/20 border border-white/10 hover:border-rose-500/20 rounded-xl transition-all cursor-pointer font-medium"
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-500" />
              הוספת חודש שקיפות חדש
            </h3>
            <p className="text-xs text-gray-400 leading-snug">
              בחר חודש ושנה. ההוצאות הקבועות יועתקו אוטומטית עם הסכומים שלהן, וההוצאות המשתנות יתחילו ריקות למילוי מחדש.
            </p>

            <form onSubmit={handleAddMonthSubmit} className="space-y-4 pt-1">
              {/* Year stepper with arrows */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400 font-medium">שנה</label>
                <div className="flex items-center justify-between bg-[#1a1a1a] border border-white/10 rounded-xl px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setNewMonthYear((y) => Math.max(new Date().getFullYear(), y - 1))}
                    disabled={newMonthYear <= new Date().getFullYear()}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="שנה קודמת"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="text-lg font-black font-mono text-white select-none">{newMonthYear}</span>
                  <button
                    type="button"
                    onClick={() => setNewMonthYear((y) => y + 1)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="שנה הבאה"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Month grid picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400 font-medium">חודש</label>
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
                            ? 'bg-[#22c55e] text-black border-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                            : alreadyExists
                            ? 'bg-transparent text-gray-600 border-white/5 cursor-not-allowed line-through'
                            : 'bg-[#1a1a1a] text-gray-300 border-white/10 hover:border-[#22c55e]/50 hover:text-white cursor-pointer'
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
                  className="flex-1 bg-[#22c55e] hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-extrabold py-2.5 px-3 rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
                >
                  {isCreatingMonth ? 'יוצר חודש...' : 'הוסף חודש'}
                </button>
                <button
                  id="close-mon-modal"
                  type="button"
                  onClick={() => setIsAddingMonthModal(false)}
                  className="flex-1 bg-[#1a1a1a] hover:bg-white/5 border border-white/10 py-2.5 px-3 rounded-xl text-gray-400 text-xs text-center transition duration-200 cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled Footer block from design */}
      <footer className="hidden md:flex h-10 bg-[#0d0d0d] border-t border-white/10 px-8 items-center justify-between text-[11px] text-gray-500 font-medium mt-auto">
        <div className="flex gap-4">
          <span className="hover:text-gray-450 cursor-pointer transition-colors">תנאי שימוש</span>
          <span className="hover:text-gray-450 cursor-pointer transition-colors">תמיכה בקצה</span>
          <span className="hover:text-gray-450 cursor-pointer transition-colors">מדיניות פרטיות</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ICE DIAMONDS © 2026</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></div>
          <span>מערכת פיננסית פעילה ומלוטשת</span>
        </div>
      </footer>

      {/* Overdue-payment toast (bottom-right, once per load) */}
      {payNotif && payNotif.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)] bg-[#141414] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden animate-[slideIn_0.25s_ease-out]">
          <div className="flex items-start justify-between gap-3 px-4 py-3 bg-rose-950/30 border-b border-rose-500/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏰</span>
              <div>
                <div className="text-sm font-bold text-rose-300">עבר זמן התשלום!</div>
                <div className="text-[11px] text-gray-400">{payNotif.length} ספקים ממתינים לתשלום</div>
              </div>
            </div>
            <button
              onClick={() => setPayNotif(null)}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
              title="סגור"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto p-3 space-y-1.5">
            {payNotif.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none shrink-0">{v.mood === 'angry' ? '😠' : '😐'}</span>
                  <span className="text-sm text-gray-200 truncate">{v.name}</span>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400 shrink-0">
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
