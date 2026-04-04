-- Drop the actual trial trigger (correct name)
DROP TRIGGER IF EXISTS trigger_set_trial_on_new_organization ON public.organizations;

-- Also drop the function it calls
DROP FUNCTION IF EXISTS public.set_trial_on_new_organization();