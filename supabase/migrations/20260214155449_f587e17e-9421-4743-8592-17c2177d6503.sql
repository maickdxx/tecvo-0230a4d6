
-- Update trial trigger: 14 days -> 7 days for NEW organizations only
CREATE OR REPLACE FUNCTION public.set_trial_on_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS NULL OR NEW.plan = 'free' THEN
    NEW.plan := 'essential';
    NEW.trial_started_at := now();
    NEW.trial_ends_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;
