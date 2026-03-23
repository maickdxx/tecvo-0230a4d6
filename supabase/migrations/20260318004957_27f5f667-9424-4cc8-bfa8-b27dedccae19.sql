CREATE OR REPLACE FUNCTION public.protect_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Service role (NULL auth.uid()) bypasses
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Super admins can update billing fields
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Prevent regular users from changing billing fields
  NEW.plan := OLD.plan;
  NEW.plan_expires_at := OLD.plan_expires_at;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.stripe_price_id := OLD.stripe_price_id;
  NEW.subscription_status := OLD.subscription_status;
  NEW.cancel_at_period_end := OLD.cancel_at_period_end;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.past_due_since := OLD.past_due_since;

  RETURN NEW;
END;
$$;