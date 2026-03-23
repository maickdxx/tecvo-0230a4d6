
-- Trigger: auto-set trial fields on new organization creation
-- Sets plan to 'essential' and trial for 14 days for every new organization
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
    NEW.trial_ends_at := now() + interval '14 days';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_set_trial_on_new_organization ON public.organizations;

-- Create trigger BEFORE INSERT
CREATE TRIGGER trigger_set_trial_on_new_organization
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trial_on_new_organization();
