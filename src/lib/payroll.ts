import type { Employee, EmployeeMonth } from '../types';

export const VAT_RATE = 0.18; // Israeli VAT

export interface PayBreakdown {
  hourlyPay: number;     // hours × hourly rate
  fixedPay: number;      // monthly fee
  ownCommission: number; // deals × value per deal × own %
  overridePay: number;   // reps-under-me (deals × value per deal) × override %
  subtotal: number;      // before VAT
  vat: number;           // added only for עוסק מורשה
  total: number;         // what is owed this month
}

const n = (v: unknown) => Number(v) || 0;

// Total value sold in a month = number of deals × value per deal
export const salesValue = (m: EmployeeMonth | undefined) => n(m?.deals_count) * n(m?.deals_amount);

/**
 * What one employee is owed for one month.
 * Override example: Elad is manager of Dana with override 3% → Elad also earns
 * 3% of the value of every deal Dana closes (on top of Dana's own %).
 */
export function computePay(
  emp: Employee,
  month: EmployeeMonth | undefined,
  allEmployees: Employee[],
  monthsByEmployee: Record<string, EmployeeMonth | undefined>
): PayBreakdown {
  const hourlyPay = n(emp.hourly_rate) * n(month?.hours);
  const fixedPay = n(emp.monthly_fee);
  // e.g. 3 deals × 1,500 ₪ × 5% = 225 ₪
  const ownCommission = (salesValue(month) * n(emp.commission_pct)) / 100;

  const reportsAmount = allEmployees
    .filter((e) => e.manager_id === emp.id && e.id !== emp.id)
    .reduce((sum, e) => sum + salesValue(monthsByEmployee[e.id]), 0);
  const overridePay = (reportsAmount * n(emp.override_pct)) / 100;

  const subtotal = hourlyPay + fixedPay + ownCommission + overridePay;
  const vat = emp.vat_mode === 'plus_vat' ? subtotal * VAT_RATE : 0;
  return { hourlyPay, fixedPay, ownCommission, overridePay, subtotal, vat, total: subtotal + vat };
}
