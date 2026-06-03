-- Supabase Database Seed File for Ice Diamonds Jewelry Business

-- 1. Create tables
CREATE TABLE IF NOT EXISTS months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    month_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_id UUID REFERENCES months(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('שולם', 'שולם חלקית', 'לא שולם')) DEFAULT 'לא שולם',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS variable_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_id UUID REFERENCES months(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('שולם', 'שולם חלקית', 'לא שולם')) DEFAULT 'לא שולם',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_id UUID REFERENCES months(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    monthly_payment NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_date TEXT,
    original_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS income_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_id UUID REFERENCES months(id) ON DELETE CASCADE NOT NULL,
    source TEXT NOT NULL, -- מקסימוס, UPS, מזומן, העברה בנקאית, קארדקום
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    channel TEXT NOT NULL, -- שבוע 1, שבוע 2, וכו׳
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_id UUID REFERENCES months(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    route_from TEXT NOT NULL,
    route_to TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security) on all tables
ALTER TABLE months ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Simple Single User RLS Policies (Allow authenticated users full access)
CREATE POLICY "Allow authenticated full access to months" ON months FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to fixed_expenses" ON fixed_expenses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to variable_expenses" ON variable_expenses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to debts" ON debts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to income_entries" ON income_entries FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to deliveries" ON deliveries FOR ALL TO authenticated USING (true);

-- 2. Insert Seed Data for April 2026 (first declare month, then use its reference or a constant ID for seeding)
-- For standard SQL seed, let's pre-insert with static user-friendly UUIDs or clean identifiers

INSERT INTO months (id, name, year, month_number) VALUES 
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'אפריל', 2026, 4),
('b8d8ca7b-ce1a-464c-bbf4-d75ff39d0cc2', 'מאי', 2026, 5),
('c9d8ca7b-ce1a-464c-bbf4-d75ff39d0cc3', 'יוני', 2026, 6)
ON CONFLICT (id) DO NOTHING;

-- Seed fixed_expenses
INSERT INTO fixed_expenses (month_id, name, amount, status, notes) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'שכירות סטודיו', 5000.00, 'שולם', 'כולל דמי ניהול'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'ארנונה', 800.00, 'שולם חלקית', 'דו חודשי'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'חשמל', 1200.00, 'לא שולם', 'הוראת קבע'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'אינטרנט וסלולר', 250.00, 'שולם', 'בזק בינלאומי');

-- Seed variable_expenses
INSERT INTO variable_expenses (month_id, name, amount, status, date, notes) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'חומרי גלם (כסף/זהב)', 15400.00, 'שולם', '2026-04-12', 'קנייה מסיטונאי ראשי'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'אריזות ממותגות', 3200.00, 'שולם חלקית', '2026-04-15', 'קרטונים ושקיות משי'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'פרסום באינסטגרם', 4500.00, 'שולם', '2026-04-20', 'קמפיין פסח סושיאל'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'תיקוני מכונות', 1800.00, 'לא שולם', '2026-04-25', 'תיקון מלטשת דיסק');

-- Seed debts
INSERT INTO debts (month_id, name, monthly_payment, current_balance, original_amount, payment_date) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'הלוואת פתיחה בנק לאומי', 2500.00, 45000.00, 100000.00, '10'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'ספק מכונות ליסינג', 1200.00, 14400.00, 30000.00, '15');

-- Seed income_entries (April 2026)
-- Week 1
INSERT INTO income_entries (month_id, source, amount, channel, date) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מקסימוס', 8500.00, 'שבוע 1', '2026-04-03'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'UPS', 3200.00, 'שבוע 1', '2026-04-04'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מזומן', 1500.00, 'שבוע 1', '2026-04-05'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'העברה בנקאית', 9000.00, 'שבוע 1', '2026-04-05'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'קארדקום', 12400.00, 'שבוע 1', '2026-04-05');

-- Week 2
INSERT INTO income_entries (month_id, source, amount, channel, date) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מקסימוס', 9200.00, 'שבוע 2', '2026-04-10'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'UPS', 4100.00, 'שבוע 2', '2026-04-11'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מזומן', 2000.00, 'שבוע 2', '2026-04-12'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'העברה בנקאית', 0.00, 'שבוע 2', '2026-04-12'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'קארדקום', 14200.00, 'שבוע 2', '2026-04-12');

-- Week 3
INSERT INTO income_entries (month_id, source, amount, channel, date) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מקסימוס', 7800.00, 'שבוע 3', '2026-04-17'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'UPS', 3500.00, 'שבוע 3', '2026-04-18'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מזומן', 1800.00, 'שבוע 3', '2026-04-19'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'העברה בנקאית', 15000.00, 'שבוע 3', '2026-04-19'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'קארדקום', 11900.00, 'שבוע 3', '2026-04-19');

-- Week 4
INSERT INTO income_entries (month_id, source, amount, channel, date) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מקסימוס', 11200.00, 'שבוע 4', '2026-04-24'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'UPS', 4600.00, 'שבוע 4', '2026-04-25'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'מזומן', 3500.00, 'שבוע 4', '2026-04-26'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'העברה בנקאית', 8000.00, 'שבוע 4', '2026-04-26'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', 'קארדקום', 18400.00, 'שבוע 4', '2026-04-26');

-- Seed deliveries
INSERT INTO deliveries (month_id, date, route_from, route_to, price, notes) VALUES
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', '2026-04-05', 'רמת גן', 'תל אביב', 150.00, 'משלוח מהיר ללקוח קצה'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', '2026-04-12', 'רמת גן', 'ירושלים', 250.00, 'איסוף חומרי גלם מיוחדים'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', '2026-04-18', 'תל אביב', 'חיפה', 320.00, 'מסירת טבעת יהלומי מעבדה'),
('a7d8ca7b-ce1a-464c-bbf4-d75ff39d0cc1', '2026-04-26', 'רמת גן', 'ראשון לציון', 180.00, 'משלוח תכשיטים לתערוכה');
