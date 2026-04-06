
-- Remove the dispatch-welcome trigger
DROP TRIGGER IF EXISTS trigger_dispatch_welcome ON public.user_roles;
DROP FUNCTION IF EXISTS public.dispatch_welcome_on_owner();

-- Disable all generic trial/marketing automations
UPDATE public.analytics_automations
SET enabled = false, updated_at = now()
WHERE trigger_type IN (
  'trial_d0', 'trial_d1', 'trial_d3', 'trial_d5', 'trial_d7',
  'trial_d10', 'trial_d13', 'trial_d14',
  'trial_ending_3d', 'trial_ending_1d', 'trial_ending_0d',
  'post_trial_d1', 'post_trial_d3', 'post_trial_d7',
  'activation_d0', 'activation_d1', 'activation_d3', 'activation_d5', 'activation_d7',
  'free_recovery_d1', 'free_recovery_d3', 'free_recovery_d7',
  'signup_recovery', 'new_user_activation'
);

-- Mark all pending lead followups as completed
UPDATE public.lead_followups
SET status = 'completed', completed_at = now(), updated_at = now()
WHERE status = 'pending';

-- Cancel all pending/processing campaign sends
UPDATE public.campaign_sends
SET status = 'cancelled', updated_at = now()
WHERE status IN ('pending', 'processing');

-- Remove cron jobs for deleted functions
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'lead-followup-cron',
  'invoke-lead-followup-cron',
  'populate-campaign-queue',
  'invoke-populate-campaign-queue',
  'process-campaign-queue',
  'invoke-process-campaign-queue'
);
