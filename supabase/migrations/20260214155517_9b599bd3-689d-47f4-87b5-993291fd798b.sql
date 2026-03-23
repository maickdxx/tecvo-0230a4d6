
-- Also update the older set_organization_trial function to 7 days
CREATE OR REPLACE FUNCTION public.set_organization_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  NEW.trial_started_at := COALESCE(NEW.trial_started_at, now());
  NEW.trial_ends_at := COALESCE(NEW.trial_ends_at, now() + interval '7 days');
  RETURN NEW;
END;
$$;
