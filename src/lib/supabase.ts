import { createClient } from '@supabase/supabase-js';
import { 
  Month, 
  FixedExpense, 
  VariableExpense, 
  Debt, 
  IncomeEntry, 
  Delivery, 
  PaymentStatus, 
  IncomeSource 
} from '../types';

// Retrieve environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Determine if we should run in live Supabase mode vs Local Demo mode
export const isLiveSupabase = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabaseClient = isLiveSupabase 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Initial Seed Data for April 2026
const INITIAL_MONTHS: Month[] = [
  { id: 'month_apr_2026', name: 'אפריל', year: 2026, month_number: 4 },
  { id: 'month_may_2026', name: 'מאי', year: 2026, month_number: 5 },
  { id: 'month_jun_2026', name: 'יוני', year: 2026, month_number: 6 }
];

const INITIAL_FIXED_EXPENSES: FixedExpense[] = [
  { id: 'fe_1', month_id: 'month_apr_2026', name: 'שכירות סטודיו', amount: 5000, status: 'שולם', notes: 'כולל דמי ניהול' },
  { id: 'fe_2', month_id: 'month_apr_2026', name: 'ארנונה', amount: 800, status: 'שולם חלקית', notes: 'דו חודשי' },
  { id: 'fe_3', month_id: 'month_apr_2026', name: 'חשמל', amount: 1200, status: 'לא שולם', notes: 'הוראת קבע' },
  { id: 'fe_4', month_id: 'month_apr_2026', name: 'אינטרנט וסלולר', amount: 250, status: 'שולם', notes: 'בזק בינלאומי' },
  // May fallback
  { id: 'fe_5', month_id: 'month_may_2026', name: 'שכירות סטודיו', amount: 5000, status: 'שולם', notes: 'כולל דמי ניהול' },
  { id: 'fe_6', month_id: 'month_may_2026', name: 'ארנונה', amount: 800, status: 'שולם', notes: 'דו חודשי' },
  { id: 'fe_7', month_id: 'month_may_2026', name: 'חשמל', amount: 1100, status: 'שולם', notes: 'הוראת קבע' },
  { id: 'fe_8', month_id: 'month_may_2026', name: 'אינטרנט וסלולר', amount: 250, status: 'שולם', notes: 'בזק בינלאומי' }
];

const INITIAL_VARIABLE_EXPENSES: VariableExpense[] = [
  { id: 've_1', month_id: 'month_apr_2026', name: 'חומרי גלם (כסף/זהב)', amount: 15400, date: '2026-04-12', status: 'שולם', notes: 'קנייה מסיטונאי ראשי' },
  { id: 've_2', month_id: 'month_apr_2026', name: 'אריזות ממותגות', amount: 3200, date: '2026-04-15', status: 'שולם חלקית', notes: 'קרטונים ושקיות משי' },
  { id: 've_3', month_id: 'month_apr_2026', name: 'פרסום באינסטגרם', amount: 4500, date: '2026-04-20', status: 'שולם', notes: 'קמפיין פסח סושיאל' },
  { id: 've_4', month_id: 'month_apr_2026', name: 'תיקוני מכונות', amount: 1800, date: '2026-04-25', status: 'לא שולם', notes: 'תיקון מלטשת דיסק' }
];

const INITIAL_DEBTS: Debt[] = [
  { id: 'd_1', month_id: 'month_apr_2026', name: 'הלוואת פתיחה בנק לאומי', monthly_payment: 2500, current_balance: 45000, original_amount: 100000, payment_date: '10' },
  { id: 'd_2', month_id: 'month_apr_2026', name: 'ספק מכונות ליסינג', monthly_payment: 1200, current_balance: 14400, original_amount: 30000, payment_date: '15' }
];

const INITIAL_INCOME: IncomeEntry[] = [
  // Week 1
  { id: 'inc_1_1', month_id: 'month_apr_2026', source: 'מקסימוס', amount: 8500, channel: 'שבוע 1', date: '2026-04-03' },
  { id: 'inc_1_2', month_id: 'month_apr_2026', source: 'UPS', amount: 3200, channel: 'שבוע 1', date: '2026-04-04' },
  { id: 'inc_1_3', month_id: 'month_apr_2026', source: 'מזומן', amount: 1500, channel: 'שבוע 1', date: '2026-04-05' },
  { id: 'inc_1_4', month_id: 'month_apr_2026', source: 'העברה בנקאית', amount: 9000, channel: 'שבוע 1', date: '2026-04-05' },
  { id: 'inc_1_5', month_id: 'month_apr_2026', source: 'קארדקום', amount: 12400, channel: 'שבוע 1', date: '2026-04-05' },
  // Week 2
  { id: 'inc_2_1', month_id: 'month_apr_2026', source: 'מקסימוס', amount: 9200, channel: 'שבוע 2', date: '2026-04-10' },
  { id: 'inc_2_2', month_id: 'month_apr_2026', source: 'UPS', amount: 4100, channel: 'שבוע 2', date: '2026-04-11' },
  { id: 'inc_2_3', month_id: 'month_apr_2026', source: 'מזומן', amount: 2000, channel: 'שבוע 2', date: '2026-04-12' },
  { id: 'inc_2_4', month_id: 'month_apr_2026', source: 'העברה בנקאית', amount: 0, channel: 'שבוע 2', date: '2026-04-12' },
  { id: 'inc_2_5', month_id: 'month_apr_2026', source: 'קארדקום', amount: 14200, channel: 'שבוע 2', date: '2026-04-12' },
  // Week 3
  { id: 'inc_3_1', month_id: 'month_apr_2026', source: 'מקסימוס', amount: 7800, channel: 'שבוע 3', date: '2026-04-17' },
  { id: 'inc_3_2', month_id: 'month_apr_2026', source: 'UPS', amount: 3500, channel: 'שבוע 3', date: '2026-04-18' },
  { id: 'inc_3_3', month_id: 'month_apr_2026', source: 'מזומן', amount: 1800, channel: 'שבוע 3', date: '2026-04-19' },
  { id: 'inc_3_4', month_id: 'month_apr_2026', source: 'העברה בנקאית', amount: 15000, channel: 'שבוע 3', date: '2026-04-19' },
  { id: 'inc_3_5', month_id: 'month_apr_2026', source: 'קארדקום', amount: 11900, channel: 'שבוע 3', date: '2026-04-19' },
  // Week 4
  { id: 'inc_4_1', month_id: 'month_apr_2026', source: 'מקסימוס', amount: 11200, channel: 'שבוע 4', date: '2026-04-24' },
  { id: 'inc_4_2', month_id: 'month_apr_2026', source: 'UPS', amount: 4600, channel: 'שבוע 4', date: '2026-04-25' },
  { id: 'inc_4_3', month_id: 'month_apr_2026', source: 'מזומן', amount: 3500, channel: 'שבוע 4', date: '2026-04-26' },
  { id: 'inc_4_4', month_id: 'month_apr_2026', source: 'העברה בנקאית', amount: 8000, channel: 'שבוע 4', date: '2026-04-26' },
  { id: 'inc_4_5', month_id: 'month_apr_2026', source: 'קארדקום', amount: 18400, channel: 'שבוע 4', date: '2026-04-26' }
];

const INITIAL_DELIVERIES: Delivery[] = [
  { id: 'del_1', month_id: 'month_apr_2026', date: '2026-04-05', route_from: 'רמת גן', route_to: 'תל אביב', price: 150, notes: 'משלוח מהיר ללקוח קצה' },
  { id: 'del_2', month_id: 'month_apr_2026', date: '2026-04-12', route_from: 'רמת גן', route_to: 'ירושלים', price: 250, notes: 'איסוף חומרי גלם מיוחדים' },
  { id: 'del_3', month_id: 'month_apr_2026', date: '2026-04-18', route_from: 'תל אביב', route_to: 'חיפה', price: 320, notes: 'מסירת טבעת יהלומי מעבדה' },
  { id: 'del_4', month_id: 'month_apr_2026', date: '2026-04-26', route_from: 'רמת גן', route_to: 'ראשון לציון', price: 180, notes: 'משלוח תכשיטים לתערוכה' }
];

// LocalStorage Helper Initializer
const initializeLocalStorage = () => {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem('icediamonds_months')) {
    localStorage.setItem('icediamonds_months', JSON.stringify(INITIAL_MONTHS));
    localStorage.setItem('icediamonds_fixed_expenses', JSON.stringify(INITIAL_FIXED_EXPENSES));
    localStorage.setItem('icediamonds_variable_expenses', JSON.stringify(INITIAL_VARIABLE_EXPENSES));
    localStorage.setItem('icediamonds_debts', JSON.stringify(INITIAL_DEBTS));
    localStorage.setItem('icediamonds_income', JSON.stringify(INITIAL_INCOME));
    localStorage.setItem('icediamonds_deliveries', JSON.stringify(INITIAL_DELIVERIES));
    localStorage.setItem('icediamonds_user', JSON.stringify({ email: 'amitshop23@gmail.com' }));
  }
};

initializeLocalStorage();

// Helper functions for mock data storage
const getFromStorage = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(`icediamonds_${key}`);
  return raw ? JSON.parse(raw) : [];
};

const saveToStorage = <T>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`icediamonds_${key}`, JSON.stringify(data));
};

// Generic Client SDK wrap
export const dbService = {
  // Authentication
  async login(emailValue: string, passwordValue: string): Promise<{ success: boolean; error?: string; user?: any }> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, user: data.user };
    } else {
      // Mock validation with secure environment variables if configured
      const emailLower = emailValue.trim().toLowerCase();
      
      const allowedUser1 = ((import.meta as any).env?.VITE_STAGING_USER_1 || 'amitshop23@gmail.com').trim().toLowerCase();
      const allowedUser2 = ((import.meta as any).env?.VITE_STAGING_USER_2 || 'dne@hasharon.diamonds').trim().toLowerCase();
      const allowedPassword = (import.meta as any).env?.VITE_STAGING_PASSWORD || '123456';

      if ((emailLower === allowedUser1 || emailLower === allowedUser2) && passwordValue === allowedPassword) {
        const user = { email: emailLower };
        localStorage.setItem('icediamonds_logged_in_user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: 'דוא״ל או סיסמה שגויים.' };
    }
  },

  async logout(): Promise<void> {
    if (isLiveSupabase && supabaseClient) {
      await supabaseClient.auth.signOut();
    } else {
      localStorage.removeItem('icediamonds_logged_in_user');
    }
  },

  async getCurrentUser(): Promise<any | null> {
    if (isLiveSupabase && supabaseClient) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      return user;
    } else {
      const rawUser = localStorage.getItem('icediamonds_logged_in_user');
      return rawUser ? JSON.parse(rawUser) : null;
    }
  },

  // Months
  async getMonths(): Promise<Month[]> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('months')
        .select('*')
        .order('year', { ascending: true })
        .order('month_number', { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    } else {
      return getFromStorage<Month>('months');
    }
  },

  async addMonth(name: string, year: number, month_number: number): Promise<Month> {
    const newMonth: Month = {
      id: 'month_gen_' + Math.random().toString(36).substr(2, 9),
      name,
      year,
      month_number
    };
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('months')
        .insert([{ name, year, month_number }])
        .select();
      if (error) throw error;
      return data[0];
    } else {
      const months = getFromStorage<Month>('months');
      months.push(newMonth);
      saveToStorage('months', months);
      return newMonth;
    }
  },

  // Fixed Expenses
  async getFixedExpenses(monthId: string): Promise<FixedExpense[]> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('fixed_expenses')
        .select('*')
        .eq('month_id', monthId);
      if (error) throw error;
      return (data as any) || [];
    } else {
      const expenses = getFromStorage<FixedExpense>('fixed_expenses');
      return expenses.filter(e => e.month_id === monthId);
    }
  },

  async saveFixedExpense(expense: Omit<FixedExpense, 'id'> & { id?: string }): Promise<FixedExpense> {
    if (isLiveSupabase && supabaseClient) {
      if (expense.id && !expense.id.startsWith('fe_')) {
        const { data, error } = await supabaseClient
          .from('fixed_expenses')
          .update(expense)
          .eq('id', expense.id)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabaseClient
          .from('fixed_expenses')
          .insert([expense])
          .select();
        if (error) throw error;
        return data[0];
      }
    } else {
      let expenses = getFromStorage<FixedExpense>('fixed_expenses');
      if (expense.id) {
        expenses = expenses.map(e => e.id === expense.id ? { ...e, ...expense } as FixedExpense : e);
        saveToStorage('fixed_expenses', expenses);
        return expense as FixedExpense;
      } else {
        const newEx: FixedExpense = {
          ...expense,
          id: 'fe_' + Math.random().toString(36).substr(2, 9),
        } as FixedExpense;
        expenses.push(newEx);
        saveToStorage('fixed_expenses', expenses);
        return newEx;
      }
    }
  },

  async deleteFixedExpense(id: string): Promise<void> {
    if (isLiveSupabase && supabaseClient) {
      const { error } = await supabaseClient
        .from('fixed_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      let expenses = getFromStorage<FixedExpense>('fixed_expenses');
      expenses = expenses.filter(e => e.id !== id);
      saveToStorage('fixed_expenses', expenses);
    }
  },

  // Variable Expenses
  async getVariableExpenses(monthId: string): Promise<VariableExpense[]> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('variable_expenses')
        .select('*')
        .eq('month_id', monthId);
      if (error) throw error;
      return (data as any) || [];
    } else {
      const expenses = getFromStorage<VariableExpense>('variable_expenses');
      return expenses.filter(e => e.month_id === monthId);
    }
  },

  async saveVariableExpense(expense: Omit<VariableExpense, 'id'> & { id?: string }): Promise<VariableExpense> {
    if (isLiveSupabase && supabaseClient) {
      // An empty date ("unknown" billing day) must be stored as NULL, not ''
      const payload: any = { ...expense, date: expense.date ? expense.date : null };
      if (expense.id && !expense.id.startsWith('ve_')) {
        const { data, error } = await supabaseClient
          .from('variable_expenses')
          .update(payload)
          .eq('id', expense.id)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabaseClient
          .from('variable_expenses')
          .insert([payload])
          .select();
        if (error) throw error;
        return data[0];
      }
    } else {
      let expenses = getFromStorage<VariableExpense>('variable_expenses');
      if (expense.id) {
        expenses = expenses.map(e => e.id === expense.id ? { ...e, ...expense } as VariableExpense : e);
        saveToStorage('variable_expenses', expenses);
        return expense as VariableExpense;
      } else {
        const newEx: VariableExpense = {
          ...expense,
          id: 've_' + Math.random().toString(36).substr(2, 9),
        } as VariableExpense;
        expenses.push(newEx);
        saveToStorage('variable_expenses', expenses);
        return newEx;
      }
    }
  },

  async deleteVariableExpense(id: string): Promise<void> {
    if (isLiveSupabase && supabaseClient) {
      const { error } = await supabaseClient
        .from('variable_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      let expenses = getFromStorage<VariableExpense>('variable_expenses');
      expenses = expenses.filter(e => e.id !== id);
      saveToStorage('variable_expenses', expenses);
    }
  },

  // Debts
  async getDebts(monthId: string): Promise<Debt[]> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('debts')
        .select('*')
        .eq('month_id', monthId);
      if (error) throw error;
      return (data as any) || [];
    } else {
      const debts = getFromStorage<Debt>('debts');
      // If none found for this month, copy from another month or create init
      const currentMonthDebts = debts.filter(d => d.month_id === monthId);
      if (currentMonthDebts.length === 0) {
        // Carry forward from previous or initial
        const initialWithCurMonth = INITIAL_DEBTS.map(d => ({ ...d, id: 'd_gen_' + Math.random().toString(36).substr(2, 5), month_id: monthId }));
        saveToStorage('debts', [...debts, ...initialWithCurMonth]);
        return initialWithCurMonth;
      }
      return currentMonthDebts;
    }
  },

  async saveDebt(debt: Omit<Debt, 'id'> & { id?: string }): Promise<Debt> {
    if (isLiveSupabase && supabaseClient) {
      if (debt.id && !debt.id.startsWith('d_')) {
        const { data, error } = await supabaseClient
          .from('debts')
          .update(debt)
          .eq('id', debt.id)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabaseClient
          .from('debts')
          .insert([debt])
          .select();
        if (error) throw error;
        return data[0];
      }
    } else {
      let debts = getFromStorage<Debt>('debts');
      if (debt.id) {
        debts = debts.map(d => d.id === debt.id ? { ...d, ...debt } as Debt : d);
        saveToStorage('debts', debts);
        return debt as Debt;
      } else {
        const newDebt: Debt = {
          ...debt,
          id: 'd_' + Math.random().toString(36).substr(2, 9),
        } as Debt;
        debts.push(newDebt);
        saveToStorage('debts', debts);
        return newDebt;
      }
    }
  },

  async deleteDebt(id: string): Promise<void> {
    if (isLiveSupabase && supabaseClient) {
      const { error } = await supabaseClient
        .from('debts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      let debts = getFromStorage<Debt>('debts');
      debts = debts.filter(d => d.id !== id);
      saveToStorage('debts', debts);
    }
  },

  // Income Entries
  async getIncomeEntries(monthId: string): Promise<IncomeEntry[]> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('income_entries')
        .select('*')
        .eq('month_id', monthId);
      if (error) throw error;
      return (data as any) || [];
    } else {
      const incomes = getFromStorage<IncomeEntry>('income');
      return incomes.filter(i => i.month_id === monthId);
    }
  },

  async saveIncomeEntry(income: Omit<IncomeEntry, 'id'> & { id?: string }): Promise<IncomeEntry> {
    if (isLiveSupabase && supabaseClient) {
      if (income.id && !income.id.startsWith('inc_')) {
        const { data, error } = await supabaseClient
          .from('income_entries')
          .update(income)
          .eq('id', income.id)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabaseClient
          .from('income_entries')
          .insert([income])
          .select();
        if (error) throw error;
        return data[0];
      }
    } else {
      let incomes = getFromStorage<IncomeEntry>('income');
      if (income.id) {
        incomes = incomes.map(i => i.id === income.id ? { ...i, ...income } as IncomeEntry : i);
        saveToStorage('income', incomes);
        return income as IncomeEntry;
      } else {
        const newInc: IncomeEntry = {
          ...income,
          id: 'inc_' + Math.random().toString(36).substr(2, 9),
        } as IncomeEntry;
        incomes.push(newInc);
        saveToStorage('income', incomes);
        return newInc;
      }
    }
  },

  async deleteIncomeEntry(id: string): Promise<void> {
    if (isLiveSupabase && supabaseClient) {
      const { error } = await supabaseClient
        .from('income_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      let incomes = getFromStorage<IncomeEntry>('income');
      incomes = incomes.filter(i => i.id !== id);
      saveToStorage('income', incomes);
    }
  },

  // Deliveries
  async getDeliveries(monthId: string): Promise<Delivery[]> {
    if (isLiveSupabase && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('deliveries')
        .select('*')
        .eq('month_id', monthId);
      if (error) throw error;
      return (data as any) || [];
    } else {
      const deliveries = getFromStorage<Delivery>('deliveries');
      return deliveries.filter(d => d.month_id === monthId);
    }
  },

  async saveDelivery(delivery: Omit<Delivery, 'id'> & { id?: string }): Promise<Delivery> {
    if (isLiveSupabase && supabaseClient) {
      if (delivery.id && !delivery.id.startsWith('del_')) {
        const { data, error } = await supabaseClient
          .from('deliveries')
          .update(delivery)
          .eq('id', delivery.id)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabaseClient
          .from('deliveries')
          .insert([delivery])
          .select();
        if (error) throw error;
        return data[0];
      }
    } else {
      let deliveries = getFromStorage<Delivery>('deliveries');
      if (delivery.id) {
        deliveries = deliveries.map(d => d.id === delivery.id ? { ...d, ...delivery } as Delivery : d);
        saveToStorage('deliveries', deliveries);
        return delivery as Delivery;
      } else {
        const newDel: Delivery = {
          ...delivery,
          id: 'del_' + Math.random().toString(36).substr(2, 9),
        } as Delivery;
        deliveries.push(newDel);
        saveToStorage('deliveries', deliveries);
        return newDel;
      }
    }
  },

  async deleteDelivery(id: string): Promise<void> {
    if (isLiveSupabase && supabaseClient) {
      const { error } = await supabaseClient
        .from('deliveries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      let deliveries = getFromStorage<Delivery>('deliveries');
      deliveries = deliveries.filter(d => d.id !== id);
      saveToStorage('deliveries', deliveries);
    }
  }
};
