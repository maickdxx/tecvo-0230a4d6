
-- Remove the competing DB trigger that sends welcome via broadcast-secretary
DROP TRIGGER IF EXISTS trg_notify_whatsapp_owner_welcome ON public.organizations;
-- Keep the function for reference but it won't fire automatically anymore
