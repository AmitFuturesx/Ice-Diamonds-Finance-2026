import type { FixedExpense, VariableExpense, Debt, IncomeEntry, Delivery } from '../types';

export interface MonthExportData {
  monthLabel: string; // e.g. "אוקטובר 2026"
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  deliveries: Delivery[];
}

const ILS = '#,##0 ₪';
const MOOD_LABEL: Record<string, string> = { happy: 'רגוע', neutral: 'העיר על זה', angry: 'דורש את הכסף' };
const BILLING_DAYS = [10, 15, 19];

const num = (v: unknown) => Number(v) || 0;

// Snap a day-of-month to 10 / 15 / 19, matching the dashboard buckets
const billingBucket = (day: number): string =>
  isNaN(day)
    ? 'לא ידוע'
    : `${BILLING_DAYS.reduce((p, c) => (Math.abs(c - day) < Math.abs(p - day) ? c : p))} לחודש`;

const dayFromText = (t?: string | null) => (t ? parseInt(t, 10) : NaN);
const dayFromDate = (d?: string | null) => (d ? parseInt(d.split('-')[2], 10) : NaN);

const fmtDate = (d?: string | null) => {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

const remainingPayments = (d: Debt) => {
  const pay = num(d.monthly_payment);
  return pay > 0 ? Math.max(0, Math.ceil(num(d.current_balance) / pay) - 1) : '';
};

/**
 * Builds a multi-sheet, right-to-left Excel workbook with the full status of one
 * month and triggers a download. exceljs is loaded lazily so it only costs
 * bandwidth when someone actually exports.
 */
export async function exportMonthToExcel(data: MonthExportData): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ICE DIAMONDS';
  wb.created = new Date();

  type Col = { header: string; key: string; width: number; money?: boolean };

  // Adds a styled RTL sheet with a header row, the rows, and an optional totals row
  const addSheet = (
    name: string,
    cols: Col[],
    rows: Record<string, unknown>[],
    totals?: Record<string, unknown>
  ) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    rows.forEach((r) => ws.addRow(r));

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.height = 22;

    cols.forEach((c, i) => {
      if (c.money) ws.getColumn(i + 1).numFmt = ILS;
    });

    if (totals) {
      const t = ws.addRow(totals);
      t.font = { bold: true };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    }
    return ws;
  };

  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);

  // ---------- Totals ----------
  const totalIncome = sum(data.incomeEntries, (i) => num(i.amount));
  const totalFixed = sum(data.fixedExpenses, (e) => num(e.amount));
  const totalVariable = sum(data.variableExpenses, (e) => num(e.amount));
  const totalDebts = sum(data.debts, (d) => num(d.monthly_payment));
  const totalExpenses = totalFixed + totalVariable + totalDebts;

  // Every obligation with its status + billing bucket
  const obligations = [
    ...data.fixedExpenses.map((e) => ({ amt: num(e.amount), status: e.status, bucket: billingBucket(dayFromText(e.payment_date)) })),
    ...data.variableExpenses.map((e) => ({ amt: num(e.amount), status: e.status, bucket: billingBucket(dayFromDate(e.date)) })),
    ...data.debts.map((d) => ({ amt: num(d.monthly_payment), status: d.status || 'לא שולם', bucket: billingBucket(dayFromText(d.payment_date)) }))
  ];
  const paid = sum(obligations.filter((o) => o.status === 'שולם'), (o) => o.amt);

  // ---------- Sheet 1: summary ----------
  const summary = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true }] });
  summary.columns = [{ width: 34 }, { width: 18 }, { width: 18 }];
  const title = summary.addRow([`דוח חודשי — ${data.monthLabel}`]);
  title.font = { bold: true, size: 16, color: { argb: 'FF16A34A' } };
  summary.addRow([`הופק בתאריך ${new Date().toLocaleDateString('he-IL')}`]).font = { italic: true, color: { argb: 'FF6B7280' } };
  summary.addRow([]);

  const section = (label: string) => {
    const r = summary.addRow([label]);
    r.font = { bold: true, size: 12 };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  };
  const line = (label: string, value: number) => {
    const r = summary.addRow([label, value]);
    r.getCell(2).numFmt = ILS;
  };

  section('מאזן החודש');
  line('סה״כ הכנסות', totalIncome);
  line('הוצאות קבועות', totalFixed);
  line('הוצאות משתנות', totalVariable);
  line('החזרי חובות והלוואות', totalDebts);
  line('סה״כ הוצאות', totalExpenses);
  const net = summary.addRow(['מאזן נטו (הכנסות פחות הוצאות)', totalIncome - totalExpenses]);
  net.font = { bold: true, color: { argb: totalIncome - totalExpenses >= 0 ? 'FF16A34A' : 'FFDC2626' } };
  net.getCell(2).numFmt = ILS;
  summary.addRow([]);

  section('מצב תשלומים');
  line('סה״כ לתשלום החודש', totalExpenses);
  line('כבר שולם', paid);
  line('נותר לשלם', totalExpenses - paid);
  summary.addRow([]);

  section('לפי יום חיוב');
  const bucketHead = summary.addRow(['יום חיוב', 'סה״כ', 'נותר לשלם']);
  bucketHead.font = { bold: true };
  ['10 לחודש', '15 לחודש', '19 לחודש', 'לא ידוע'].forEach((b) => {
    const inB = obligations.filter((o) => o.bucket === b);
    const r = summary.addRow([
      b,
      sum(inB, (o) => o.amt),
      sum(inB.filter((o) => o.status !== 'שולם'), (o) => o.amt)
    ]);
    r.getCell(2).numFmt = ILS;
    r.getCell(3).numFmt = ILS;
  });

  // ---------- Sheet 2: fixed expenses ----------
  addSheet(
    'הוצאות קבועות',
    [
      { header: 'שם ההוצאה', key: 'name', width: 28 },
      { header: 'סכום', key: 'amount', width: 14, money: true },
      { header: 'יום חיוב', key: 'day', width: 14 },
      { header: 'סטטוס', key: 'status', width: 14 },
      { header: 'מצב הספק', key: 'mood', width: 16 },
      { header: 'הערות', key: 'notes', width: 40 }
    ],
    data.fixedExpenses.map((e) => ({
      name: e.name,
      amount: num(e.amount),
      day: billingBucket(dayFromText(e.payment_date)),
      status: e.status,
      mood: MOOD_LABEL[e.mood || 'happy'],
      notes: e.notes || ''
    })),
    { name: 'סה״כ', amount: totalFixed }
  );

  // ---------- Sheet 3: variable expenses ----------
  addSheet(
    'הוצאות משתנות',
    [
      { header: 'שם ההוצאה', key: 'name', width: 28 },
      { header: 'סכום', key: 'amount', width: 14, money: true },
      { header: 'יום חיוב', key: 'day', width: 14 },
      { header: 'סטטוס', key: 'status', width: 14 },
      { header: 'מצב הספק', key: 'mood', width: 16 },
      { header: 'הערות', key: 'notes', width: 40 }
    ],
    data.variableExpenses.map((e) => ({
      name: e.name,
      amount: num(e.amount),
      day: billingBucket(dayFromDate(e.date)),
      status: e.status,
      mood: MOOD_LABEL[e.mood || 'happy'],
      notes: e.notes || ''
    })),
    { name: 'סה״כ', amount: totalVariable }
  );

  // ---------- Sheet 4: debts ----------
  addSheet(
    'חובות והלוואות',
    [
      { header: 'גורם מלווה / ספק', key: 'name', width: 26 },
      { header: 'החזר חודשי', key: 'pay', width: 14, money: true },
      { header: 'יתרת חוב', key: 'balance', width: 16, money: true },
      { header: 'קרן מקורית', key: 'orig', width: 16, money: true },
      { header: 'יום חיוב', key: 'day', width: 12 },
      { header: 'סטטוס', key: 'status', width: 14 },
      { header: 'מצב המלווה', key: 'mood', width: 16 },
      { header: 'תשלומים שנותרו', key: 'left', width: 16 }
    ],
    data.debts.map((d) => ({
      name: d.name,
      pay: num(d.monthly_payment),
      balance: num(d.current_balance),
      orig: num(d.original_amount),
      day: d.payment_date && d.payment_date !== 'לא סומן' ? `${d.payment_date} לחודש` : 'לא ידוע',
      status: d.status || 'לא שולם',
      mood: MOOD_LABEL[d.mood || 'happy'],
      left: remainingPayments(d)
    })),
    {
      name: 'סה״כ',
      pay: totalDebts,
      balance: sum(data.debts, (d) => num(d.current_balance)),
      orig: sum(data.debts, (d) => num(d.original_amount))
    }
  );

  // ---------- Sheet 5: income ----------
  addSheet(
    'הכנסות',
    [
      { header: 'תאריך', key: 'date', width: 14 },
      { header: 'מקור הכנסה', key: 'source', width: 22 },
      { header: 'סכום', key: 'amount', width: 14, money: true }
    ],
    data.incomeEntries.map((i) => ({ date: fmtDate(i.date), source: i.source, amount: num(i.amount) })),
    { date: 'סה״כ', amount: totalIncome }
  );

  // ---------- Sheet 6: deliveries ----------
  const deliveriesNet = sum(data.deliveries, (d) => num(d.price));
  addSheet(
    'שליחויות',
    [
      { header: 'תאריך', key: 'date', width: 14 },
      { header: 'מוצא', key: 'from', width: 18 },
      { header: 'יעד', key: 'to', width: 18 },
      { header: 'מחיר נטו', key: 'net', width: 14, money: true },
      { header: 'כולל מע״מ (17%)', key: 'gross', width: 16, money: true },
      { header: 'הערות', key: 'notes', width: 36 }
    ],
    data.deliveries.map((d) => ({
      date: fmtDate(d.date),
      from: d.route_from,
      to: d.route_to,
      net: num(d.price),
      gross: num(d.price) * 1.17,
      notes: d.notes || ''
    })),
    { date: 'סה״כ', net: deliveriesNet, gross: deliveriesNet * 1.17 }
  );

  // ---------- Download ----------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ICE-DIAMONDS-דוח-${data.monthLabel.replace(/\s+/g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
