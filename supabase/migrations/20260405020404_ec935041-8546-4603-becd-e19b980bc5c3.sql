ALTER TABLE public.organizations
ADD COLUMN default_ai_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;