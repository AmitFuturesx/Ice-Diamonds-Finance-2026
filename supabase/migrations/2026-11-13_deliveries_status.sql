-- Deliveries get a payment status, like every other payment in the app,
-- so the dashboard's "שליחויות" block can show paid / left to pay.
-- Safe to run more than once. Existing rows start as 'לא שולם'.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'לא שולם';

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_status_check CHECK (status IN ('שולם', 'שולם חלקית', 'לא שולם'));
