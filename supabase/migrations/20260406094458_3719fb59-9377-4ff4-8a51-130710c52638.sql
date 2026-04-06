
-- Delete failed welcome email delivery logs so dispatch-welcome can retry
DELETE FROM public.onboarding_delivery_logs 
WHERE trigger_type = 'welcome' 
AND channel = 'email' 
AND status = 'failed';
