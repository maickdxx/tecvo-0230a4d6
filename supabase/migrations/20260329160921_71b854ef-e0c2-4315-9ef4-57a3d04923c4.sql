
-- Remove the OLD trigger on organizations that fires notify_new_organization
-- This trigger passes organization row as NEW, but the function now expects profile row
-- The correct trigger is on_new_profile_notify_and_welcome on profiles table
DROP TRIGGER IF EXISTS trg_notify_new_organization ON public.organizations;
