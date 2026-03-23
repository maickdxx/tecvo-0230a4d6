CREATE TABLE public.transaction_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org logs"
  ON public.transaction_status_log FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org logs"
  ON public.transaction_status_log FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());