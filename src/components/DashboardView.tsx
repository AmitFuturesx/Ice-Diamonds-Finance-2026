import { 
  FixedExpense, 
  VariableExpense, 
  Debt, 
  IncomeEntry, 
  Delivery 
} from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  CalendarDays, 
  Calculator, 
  Truck, 
  Activity,
  User,
  ArrowUpLeft,
  ArrowDownLeft,
  Coins
} from 'lucide-react';

interface DashboardViewProps {
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  deliveries: Delivery[];
  selectedMonthName: string;
}

export default function DashboardView({
  fixedExpenses,
  variableExpenses,
  debts,
  incomeEntries,
  deliveries,
  selectedMonthName
}: DashboardViewProps) {
  
  // Calculations
  const totalIncome = incomeEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  
  const totalFixed = fixedExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalVariable = variableExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalDebts = debts.reduce((acc, curr) => acc + (Number(curr.monthly_payment) || 0), 0);
  
  const totalExpenses = totalFixed + totalVariable + totalDebts;
  const netBalance = totalIncome - totalExpenses;
  const isPositive = netBalance >= 0;

  // Deliveries VAT note calculations
  const rawDeliveriesSum = deliveries.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const deliveriesWithVat = rawDeliveriesSum * 1.17; // +17% VAT

  // Percentage breakdown of expenses
  const totalAllocated = totalFixed + totalVariable + totalDebts;
  const fixedPercent = totalAllocated > 0 ? (totalFixed / totalAllocated) * 100 : 0;
  const variablePercent = totalAllocated > 0 ? (totalVariable / totalAllocated) * 100 : 0;
  const debtsPercent = totalAllocated > 0 ? (totalDebts / totalAllocated) * 100 : 0;

  // Expense-to-income efficiency indicator
  const efficiencyRatio = totalIncome > 0 ? Math.min(Math.round((totalExpenses / totalIncome) * 100), 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Overview Hero Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Net Balance Radial/Card Accent */}
        <div className="lg:col-span-2 bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] shadow-2xl">
          <div className="absolute top-0 left-0 w-32 h-32 bg-green-500/5 rounded-full blur-[40px] pointer-events-none"></div>
          
          <div className="flex items-center justify-between z-10">
            <div>
              <span className="text-xs text-gray-400 font-medium block">יתרת רווח נקי לרואי חשבון</span>
              <h2 className="text-2xl font-extrabold text-white mt-1">מאזן החודש: {selectedMonthName}</h2>
            </div>
            <div className={`p-3 rounded-xl border ${
              isPositive 
                ? 'bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-450'
            }`}>
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="mt-8 z-10 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <div className="text-xs text-gray-400 font-medium">מאזן סופי (הכנסות פחות הוצאות)</div>
              <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight mt-1 ${
                isPositive ? 'text-[#22c55e]' : 'text-rose-500'
              }`}>
                {isPositive ? '+' : ''}{netBalance.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="text-xs text-zinc-500">
              {isPositive ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/20 font-semibold tracking-wide">
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                  עמידה ביעדי רווחיות החודש
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 font-semibold tracking-wide">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  גרעון תקציבי - נדרש אופטימיזציה
                </span>
              )}
            </div>
          </div>

          {/* Miniature efficiency progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5 font-medium">
              <span>יחס הוצאות מתוך הכנסה:</span>
              <span className={efficiencyRatio > 80 ? 'text-rose-400' : 'text-[#22c55e]'}>{efficiencyRatio}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  efficiencyRatio > 80 ? 'bg-rose-500' : 'bg-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                }`}
                style={{ width: `${efficiencyRatio}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Small Highlight Bento Widget: Deliveries Tracker info */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 font-medium block">שליחויות והפצה</span>
              <h3 className="text-lg font-bold text-gray-200 mt-0.5">עלות הפצה מרוכזת</h3>
            </div>
            <div className="p-3 bg-white/5 border border-white/5 text-[#22c55e] rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-gray-400">סה״כ משלוחים ללא מע״מ</div>
            <div className="text-lg font-bold text-gray-200 mt-0.5">
              {rawDeliveriesSum.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
            </div>
            
            <div className="text-xs text-gray-400 mt-2">סה״כ משלוחים כולל מע״מ (17%)</div>
            <div className="text-2xl font-black text-[#22c55e] font-mono tracking-tight mt-0.5">
              {deliveriesWithVat.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
            </div>
          </div>

          <div className="text-xs text-gray-400 bg-white/5 p-2.5 rounded-lg border border-white/5 text-center mt-3 font-medium">
             {deliveries.length} שליחויות בוצעו החודש
          </div>
        </div>
      </div>

      {/* Primary Financial Stream Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Total Income Metrics */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[#22c55e]">
                <Coins className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">הכנסות החודש {selectedMonthName}</h4>
                <p className="text-xs text-gray-400">פילוח לפי ערוצי סליקה ומקורות</p>
              </div>
            </div>
            <span className="text-2xl font-black font-mono text-[#22c55e]">
              {totalIncome.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Quick list of channels */}
          <div className="space-y-3">
            {['מקסימוס', 'UPS', 'מזומן', 'העברה בנקאית', 'קארדקום'].map((src) => {
              const channelSum = incomeEntries
                .filter(i => i.source === src)
                .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
              const percent = totalIncome > 0 ? (channelSum / totalIncome) * 100 : 0;

              return (
                <div key={src} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-semibold">{src}</span>
                    <div className="space-x-1.5 rtl:space-x-reverse font-mono text-gray-450 font-medium">
                      <span>{channelSum.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}</span>
                      <span className="text-gray-500 text-[10px]">({percent.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div 
                      className="bg-[#22c55e] h-full rounded-full transition-all duration-300 shadow-[0_0_5px_rgba(34,197,94,0.3)]"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Expenses Metrics */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-rose-500">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">הוצאות החודש {selectedMonthName}</h4>
                <p className="text-xs text-gray-400">תעדוף וצרכים תפעוליים</p>
              </div>
            </div>
            <span className="text-2xl font-black font-mono text-rose-500">
              {totalExpenses.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Quick list of expense groups */}
          <div className="space-y-4 pt-1">
            
            {/* Fixed Expenses Row */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-100 font-semibold">הוצאות קבועות</span>
                <span className="font-mono text-gray-400">
                  {totalFixed.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })} ({fixedPercent.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${fixedPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Variable Expenses Row */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-100 font-semibold">הוצאות משתנות</span>
                <span className="font-mono text-gray-400">
                  {totalVariable.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })} ({variablePercent.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${variablePercent}%` }}
                ></div>
              </div>
            </div>

            {/* Debts Repayment Row */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-100 font-semibold">תשלומי חובות והתחייבויות</span>
                <span className="font-mono text-gray-400">
                  {totalDebts.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })} ({debtsPercent.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${debtsPercent}%` }}
                ></div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Visual representation card */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#22c55e]" />
          סיכום תזרים יתרות לפי חוק שירותים פיננסיים
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 block">סך הכנסות ברוטו</span>
            <span className="text-base sm:text-lg font-bold text-[#22c55e] font-mono tracking-tight block mt-1">
              +{totalIncome.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪
            </span>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 block">קבועות (תפעולי)</span>
            <span className="text-base sm:text-lg font-bold text-amber-500 font-mono tracking-tight block mt-1">
              -{totalFixed.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪
            </span>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 block">משתנות (רכש ופרסום)</span>
            <span className="text-base sm:text-lg font-bold text-indigo-400 font-mono tracking-tight block mt-1">
              -{totalVariable.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪
            </span>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 block">פרעון חוב חודשי</span>
            <span className="text-base sm:text-lg font-bold text-rose-500 font-mono tracking-tight block mt-1">
              -{totalDebts.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
