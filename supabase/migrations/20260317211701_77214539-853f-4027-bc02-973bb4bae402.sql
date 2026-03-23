-- 1. Add Stripe IDs and subscription_status to organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';

-- 2. Create stripe_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_summary jsonb
);

-- Enable RLS on stripe_webhook_events
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- 3. Create trigger to prevent users from directly updating billing fields
CREATE OR REPLACE FUNCTION public.protect_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If called by service_role (NULL auth.uid()), allow everything
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent users from changing billing fields directly
  NEW.plan := OLD.plan;
  NEW.plan_expires_at := OLD.plan_expires_at;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.stripe_price_id := OLD.stripe_price_id;
  NEW.subscription_status := OLD.subscription_status;
  NEW.cancel_at_period_end := OLD.cancel_at_period_end;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_billing_fields_trigger ON public.organizations;
CREATE TRIGGER protect_billing_fields_trigger
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_fields();

-- 4. Add indexes
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON public.organizations (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription_id ON public.organizations (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON public.stripe_webhook_events (event_id);