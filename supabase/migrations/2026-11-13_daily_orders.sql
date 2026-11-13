-- Daily report: how many orders came in each day (the money itself is kept as
-- income_entries rows, one per source per day, marked channel = 'יומי').
-- Safe to run more than once.
CREATE TABLE IF NOT EXISTS public.daily_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
    date DATE NOT NULL UNIQUE,
    orders INTEGER NOT NULL DEFAULT 0 CHECK (orders >= 0)
);
CREATE INDEX IF NOT EXISTS daily_orders_month ON public.daily_orders (month_id);

-- Same rule as every other table in the app: only signed-in users.
ALTER TABLE public.daily_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to daily_orders" ON public.daily_orders;
CREATE POLICY "Allow authenticated full access to daily_orders"
    ON public.daily_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_orders TO authenticated;
