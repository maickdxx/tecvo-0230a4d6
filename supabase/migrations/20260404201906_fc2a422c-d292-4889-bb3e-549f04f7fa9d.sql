
CREATE OR REPLACE FUNCTION public.set_trial_on_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only set trial if the plan is not already set (new orgs default to null/free)
  IF NEW.plan IS NULL OR NEW.plan = 'free' THEN
    NEW.plan := 'starter';
    NEW.trial_started_at := now();
    NEW.trial_ends_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;
