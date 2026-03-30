-- Add dashboard persistence columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dashboard_action_history JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS daily_routine JSONB DEFAULT '{"date": "", "completedAlertIds": []}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.dashboard_action_history IS 'Stores user-specific dashboard prioritization history and metrics';
COMMENT ON COLUMN public.profiles.daily_routine IS 'Stores user-specific daily progress and completed alert IDs';
