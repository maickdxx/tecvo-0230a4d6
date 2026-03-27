-- Disable incoherent trial journey automations (D10, D13, D14)
UPDATE public.analytics_automations
SET enabled = false
WHERE trigger_type IN ('trial_d10', 'trial_d13', 'trial_d14');

-- Ensure the trial setting function is consistently set to 7 days
CREATE OR REPLACE FUNCTION public.set_trial_on_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set trial if the plan is not already set (new orgs default to null/free)
  IF NEW.plan IS NULL OR NEW.plan = 'free' THEN
    NEW.plan := 'essential';
    NEW.trial_started_at := now();
    NEW.trial_ends_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;
