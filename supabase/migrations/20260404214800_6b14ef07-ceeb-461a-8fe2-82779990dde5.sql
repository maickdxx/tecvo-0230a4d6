-- Disable the trial trigger so new organizations no longer get a free trial
DROP TRIGGER IF EXISTS set_trial_on_new_organization ON public.organizations;