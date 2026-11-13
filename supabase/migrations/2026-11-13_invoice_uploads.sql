-- The "invoices" page: one row per file sent to morning as an expense draft,
-- so you can see what arrived (✓) and what failed (✗). The file itself is not kept here.
CREATE TABLE IF NOT EXISTS public.invoice_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error TEXT,
    morning_key TEXT,
    uploaded_by TEXT
);

-- Same rule as every other table in the app: only signed-in users.
ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to invoice_uploads" ON public.invoice_uploads;
CREATE POLICY "Allow authenticated full access to invoice_uploads"
    ON public.invoice_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_uploads TO authenticated;
