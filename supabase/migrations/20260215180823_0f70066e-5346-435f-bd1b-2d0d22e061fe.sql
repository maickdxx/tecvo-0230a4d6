ALTER TABLE public.payment_methods
ADD COLUMN default_financial_account_id uuid
REFERENCES public.financial_accounts(id) ON DELETE SET NULL;