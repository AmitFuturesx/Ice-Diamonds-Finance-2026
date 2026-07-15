import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  Landmark
} from 'lucide-react';

type ActivePage = 'dashboard' | 'fixed_expenses' | 'variable_expenses' | 'debts' | 'income' | 'deliveries';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');

  // Month select parameters
  const [months, setMonths] = useState<Month[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string>('');
  const [isLoadingMonths, setIsLoadingMonths] = useState(true);
  const [isAddingMonthModal, setIsAddingMonthModal] = useState(false);
  const [newMonthName, setNewMonthName] = useState('');
  const [newMonthYear, setNewMonthYear] = useState('2026');
  const [newMonthNumber, setNewMonthNumber] = useState('5');

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
          // Default to first month (preseed April 2026)
          setActiveMonthId(list[0].id);
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

  // Logout trigger
  const handleLogout = async () => {
    await dbService.logout();
    setCurrentUser(null);
  };

  // Add virtual month flow
  const handleAddMonthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonthName) return;

    try {
      const added = await dbService.addMonth(
        newMonthName,
        Number(newMonthYear) || 2026,
        Number(newMonthNumber) || 4
      );
      setMonths(prev => [...prev, added]);
      setActiveMonthId(added.id);
      setIsAddingMonthModal(false);
      setNewMonthName('');
    } catch (err) {
      alert('שגיאה ביצירת חודש פעילות');
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
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col pb-24 md:pb-0 font-sans antialiased text-right">
      
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
                  months.map((m) => (
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

          {/* Micro logout for mobile layout */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              id="mob-logout"
              onClick={handleLogout}
              className="p-2 bg-[#1a1a1a] border border-white/5 text-gray-400 hover:text-rose-400 rounded-full transition-colors cursor-pointer"
              title="יציאה מהחשבון"
            >
              <LogOut className="w-4 h-4" />
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

      {/* 4. Bottom Tab Navigation - Mobile only */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d] border-t border-white/10 py-2.5 px-2 md:hidden flex justify-around items-center shadow-2xl backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              id={`mob-nav-${item.id}`}
              key={item.id}
              onClick={() => setActivePage(item.id as ActivePage)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-lg cursor-pointer ${
                isActive ? 'text-[#22c55e] font-bold scale-105' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[9px] truncate tracking-tighter">{item.label}</span>
            </button>
          );
        })}
      </footer>

      {/* 5. Add Month Modal Popup */}
      {isAddingMonthModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-500" />
              הוספת חודש שקיפות חדש
            </h3>
            <p className="text-xs text-gray-400 leading-snug">
              הוסף חודש פעילות במאגר הנתונים. המערכת תתחיל לסנכרן דוחות, הוצאות והכנסות רלוונטיות לחודש זה.
            </p>

            <form onSubmit={handleAddMonthSubmit} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 font-medium">שם חודש (בעברית) *</label>
                <input
                  id="new-mon-name-input"
                  type="text"
                  required
                  placeholder="לדוג׳ יולי, אוגוסט"
                  value={newMonthName}
                  onChange={(e) => setNewMonthName(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#22c55e]/70 focus:ring-1 focus:ring-[#22c55e]/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 font-medium">שנה *</label>
                  <input
                    id="new-mon-year-input"
                    type="number"
                    required
                    placeholder="2026"
                    value={newMonthYear}
                    onChange={(e) => setNewMonthYear(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/10 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:border-[#22c55e]/70 focus:ring-1 focus:ring-[#22c55e]/20 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 font-medium">מספר חודש (1-12) *</label>
                  <input
                    id="new-mon-num-input"
                    type="number"
                    required
                    min="1"
                    max="12"
                    placeholder="7"
                    value={newMonthNumber}
                    onChange={(e) => setNewMonthNumber(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/10 outline-none rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:border-[#22c55e]/70 focus:ring-1 focus:ring-[#22c55e]/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  id="submit-new-mon"
                  type="submit"
                  className="flex-1 bg-[#22c55e] hover:bg-emerald-400 text-black font-extrabold py-2.5 px-3 rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:scale-[1.02]"
                >
                  הוסף חודש
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

    </div>
  );
}
