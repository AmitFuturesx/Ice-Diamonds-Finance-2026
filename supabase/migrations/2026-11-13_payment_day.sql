-- Payment day (10 / 15 / 19, empty = unknown) for salaries and deliveries,
-- so every payment on the dashboard can sit on a payment date.
-- Fixed expenses, variable expenses and debts already have their own date fields.
-- Safe to run more than once; existing rows start without a date.
ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS payment_day TEXT NOT NULL DEFAULT '';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS payment_day TEXT NOT NULL DEFAULT '';
