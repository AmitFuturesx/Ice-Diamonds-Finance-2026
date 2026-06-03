export interface Month {
  id: string;
  name: string; // e.g. "אפריל"
  year: number; // e.g. 2026
  month_number: number; // e.g. 4
}

export type PaymentStatus = 'שולם' | 'שולם חלקית' | 'לא שולם';

export interface FixedExpense {
  id: string;
  month_id: string;
  name: string;
  amount: number;
  notes: string;
  status: PaymentStatus;
}

export interface VariableExpense {
  id: string;
  month_id: string;
  name: string;
  amount: number;
  notes: string;
  date: string;
  status: PaymentStatus;
}

export interface Debt {
  id: string;
  month_id: string;
  name: string;
  monthly_payment: number;
  current_balance: number;
  payment_date: string; // e.g. "10" or "2026-04-15"
  original_amount: number;
}

export type IncomeSource = 'מקסימוס' | 'UPS' | 'מזומן' | 'העברה בנקאית' | 'קארדקום';

export interface IncomeEntry {
  id: string;
  month_id: string;
  source: IncomeSource;
  amount: number;
  channel: string; // e.g. "שבוע 1", "שבוע 2" etc.
  date: string;
}

export interface Delivery {
  id: string;
  month_id: string;
  date: string;
  route_from: string;
  route_to: string;
  price: number;
  notes: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalDebtsPayment: number;
  netBalance: number;
}
