
-- Fix 1: Remove duplicate recurrence trigger (trg_auto_recurrence_entry fires on UPDATE only,
-- but trg_auto_recurrence_entry_insert already fires on INSERT OR UPDATE, causing double execution on UPDATE)
DROP TRIGGER IF EXISTS trg_auto_recurrence_entry ON public.services;

-- Fix 2: Remove duplicate trial trigger (set_organization_trial conflicts with set_trial_on_new_organization)
-- Keep set_trial_on_new_organization as it has the conditional logic (only sets if plan is null/free)
DROP TRIGGER IF EXISTS set_organization_trial_trigger ON public.organizations;
DROP FUNCTION IF EXISTS public.set_organization_trial();
