-- Variable expenses become "supplier → purchases":
--   suppliers         a permanent list (shown every month, starting at ₪0)
--   variable_expenses each row is one purchase from a supplier, with its own date, VAT, status and invoice
-- Existing variable expenses: every name becomes a supplier and the rows are linked to it (nothing is deleted).
-- Safe to run more than once.
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'variable',
    vat_exempt BOOLEAN NOT NULL DEFAULT false,
    mood TEXT NOT NULL DEFAULT 'happy',
    active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to suppliers" ON public.suppliers;
CREATE POLICY "Allow authenticated full access to suppliers"
    ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;

ALTER TABLE public.variable_expenses ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.variable_expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.variable_expenses ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2);
CREATE INDEX IF NOT EXISTS variable_expenses_supplier ON public.variable_expenses (supplier_id);

-- existing rows: one supplier per distinct name, then link every row to its supplier
INSERT INTO public.suppliers (name)
SELECT DISTINCT trim(v.name)
FROM public.variable_expenses v
WHERE trim(coalesce(v.name, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.name = trim(v.name) AND s.kind = 'variable');

UPDATE public.variable_expenses v
SET supplier_id = s.id
FROM public.suppliers s
WHERE v.supplier_id IS NULL AND s.kind = 'variable' AND s.name = trim(v.name);
