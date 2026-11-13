-- Link each invoice to the payment it belongs to (fixed / variable / payroll / debt / delivery)
-- so the invoices page knows who already sent an invoice this month and who did not.
-- 'skipped' = "no invoice needed" for that payment. Safe to run more than once.
ALTER TABLE public.invoice_uploads ADD COLUMN IF NOT EXISTS month_id TEXT;
ALTER TABLE public.invoice_uploads ADD COLUMN IF NOT EXISTS item_kind TEXT;
ALTER TABLE public.invoice_uploads ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE public.invoice_uploads ADD COLUMN IF NOT EXISTS item_name TEXT;

ALTER TABLE public.invoice_uploads DROP CONSTRAINT IF EXISTS invoice_uploads_status_check;
ALTER TABLE public.invoice_uploads
    ADD CONSTRAINT invoice_uploads_status_check CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS invoice_uploads_month_item ON public.invoice_uploads (month_id, item_kind, item_id);
