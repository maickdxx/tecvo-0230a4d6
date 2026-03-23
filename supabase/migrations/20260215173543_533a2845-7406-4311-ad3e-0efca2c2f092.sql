
-- 1. Financial Accounts table
CREATE TABLE public.financial_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'cash',
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financial accounts in their org"
  ON public.financial_accounts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create financial accounts in their org"
  ON public.financial_accounts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update financial accounts in their org"
  ON public.financial_accounts FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete financial accounts in their org"
  ON public.financial_accounts FOR DELETE
  USING (organization_id = get_user_organization_id());

-- 2. Service Payments table
CREATE TABLE public.service_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  payment_method text NOT NULL,
  amount numeric NOT NULL,
  financial_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view service payments in their org"
  ON public.service_payments FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create service payments in their org"
  ON public.service_payments FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update service payments in their org"
  ON public.service_payments FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete service payments in their org"
  ON public.service_payments FOR DELETE
  USING (organization_id = get_user_organization_id());

-- 3. Add financial_account_id to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS financial_account_id uuid REFERENCES public.financial_accounts(id);
