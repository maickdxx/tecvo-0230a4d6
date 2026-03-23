CREATE TABLE public.billing_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_type text NOT NULL, -- 'purchase_confirmed', 'expiration_7d', 'expiration_3d', 'expiration_today', 'expiration_1d_after'
  recipient_email text NOT NULL,
  plan text,
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_email_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (edge functions)
-- Super admins can read
CREATE POLICY "Super admins can read billing email logs"
  ON public.billing_email_log
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Create index for dedup checks
CREATE INDEX idx_billing_email_log_org_type ON public.billing_email_log (organization_id, email_type, created_at DESC);