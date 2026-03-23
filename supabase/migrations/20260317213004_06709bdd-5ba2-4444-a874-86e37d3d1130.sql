
-- 1. Billing events table for local audit trail
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  stripe_event_id text,
  plan text,
  previous_plan text,
  amount_cents integer,
  currency text DEFAULT 'brl',
  stripe_invoice_id text,
  stripe_subscription_id text,
  status text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert (from webhook)
-- Authenticated users can read their org's events
CREATE POLICY "Users can view own org billing events"
  ON public.billing_events FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE INDEX idx_billing_events_org ON public.billing_events (organization_id, created_at DESC);

-- 2. Add past_due_since to organizations for grace period tracking
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;
