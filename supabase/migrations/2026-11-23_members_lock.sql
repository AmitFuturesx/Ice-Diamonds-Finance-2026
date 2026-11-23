-- 1. Purchases get their own payment day, so moving a payment never rewrites the purchase date.
-- 2. Being signed in is no longer enough: only users listed in members can read or write.
-- Adds and tightens only. No row is changed or deleted. Safe to run more than once.
-- Everything is one transaction: if anything fails, nothing changes.
BEGIN;

ALTER TABLE public.variable_expenses ADD COLUMN IF NOT EXISTS payment_day TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.members (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members FROM anon, authenticated;

-- the people who use the system today (first run only)
INSERT INTO public.members (user_id)
SELECT id FROM auth.users
WHERE email_confirmed_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.members);

CREATE OR REPLACE FUNCTION public.is_member() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = (SELECT auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.is_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member() TO authenticated;

DO $$
DECLARE t TEXT; p TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.members) THEN
        RAISE EXCEPTION 'No members found, stopping so nobody is locked out';
    END IF;
    FOREACH t IN ARRAY ARRAY['months','fixed_expenses','variable_expenses','suppliers','debts','income_entries','daily_orders','deliveries','employees','employee_months','invoice_uploads'] LOOP
        IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', p, t);
        END LOOP;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY members_only ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_member())) WITH CHECK ((SELECT public.is_member()))', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END LOOP;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- who can enter now:
SELECT u.email, u.last_sign_in_at::date AS last_sign_in
FROM public.members m JOIN auth.users u ON u.id = m.user_id ORDER BY 1;
