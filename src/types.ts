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
  payment_date?: string; // Billing day of month ("10"/"15"/"19") or "" for unknown
  mood?: string; // Vendor patience: 'happy' | 'neutral' | 'angry'
}

export interface VariableExpense {
  id: string;
  month_id: string;
  name: string;
  amount: number;
  notes: string;
  date: string;
  status: PaymentStatus;
  mood?: string; // Vendor patience: 'happy' | 'neutral' | 'angry'
}

export interface Debt {
  id: string;
  month_id: string;
  name: string;
  monthly_payment: number;
  current_balance: number;
  payment_date: string; // e.g. "10" or "2026-04-15"
  original_amount: number;
  status?: PaymentStatus; // Payment status of this month's installment
  mood?: string; // Lender patience: 'happy' | 'neutral' | 'angry'
}

export type IncomeSource = 'מקסימוס' | 'UPS' | 'מזומן' | 'העברה בנקאית' | 'משולם / GROW';

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
  status?: PaymentStatus; // needs the deliveries.status column (supabase/migrations/2026-11-13_deliveries_status.sql)
  payment_day?: string; // "10" / "15" / "19" or "" (supabase/migrations/2026-11-13_payment_day.sql)
}

// ---------- Employees / payroll ----------
export type Department = 'freelancer' | 'sales' | 'staff';
// plus_vat = עוסק מורשה (VAT added on top), exempt = עוסק פטור, none = שכיר (no VAT)
export type VatMode = 'plus_vat' | 'exempt' | 'none';

// A person on the payroll. Persistent across months; monthly numbers live in EmployeeMonth.
export interface Employee {
  id: string;
  name: string;
  department: Department;
  role: string;            // e.g. "שיווק", "נציג מכירות", "אחראית חנות"
  hourly_rate: number;     // ₪ per hour (0 if not hourly)
  monthly_fee: number;     // fixed monthly payment (freelancers)
  commission_pct: number;  // % of the value of deals this person closes
  manager_id: string | null; // sales: the rep's team manager
  override_pct: number;    // % this person earns on deals closed by reps under them
  vat_mode: VatMode;
  active: boolean;
  payment_day?: string; // salary day: "10" / "15" / "19" or "" (supabase/migrations/2026-11-13_payment_day.sql)
}

// One employee's numbers for one month
export interface EmployeeMonth {
  id: string;
  employee_id: string;
  month_id: string;
  hours: number;
  deals_count: number;
  deals_amount: number;    // ₪ value PER DEAL (commission = deals_count × deals_amount × %)
  status: PaymentStatus;
  notes: string;
}

// One file sent to morning (Green Invoice) as an expense draft — the ✓ / ✗ list on the invoices page
export type InvoiceUploadStatus = 'pending' | 'sent' | 'failed';
export interface InvoiceUpload {
  id: string;
  created_at: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: InvoiceUploadStatus;
  error: string | null;
  morning_key: string | null;
  uploaded_by: string | null;
}

export interface FinancialSummary {
  totalIncome: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalDebtsPayment: number;
  netBalance: number;
}
