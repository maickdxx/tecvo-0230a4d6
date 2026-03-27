-- Add metadata to user_activity_events
ALTER TABLE public.user_activity_events 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add UTM and origin fields to user_sessions
ALTER TABLE public.user_sessions 
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS landing_page TEXT;

-- Add UTM and origin fields to profiles (to capture first-ever touchpoint)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_utm_source TEXT,
ADD COLUMN IF NOT EXISTS first_utm_medium TEXT,
ADD COLUMN IF NOT EXISTS first_utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS first_referrer TEXT,
ADD COLUMN IF NOT EXISTS first_landing_page TEXT;

-- Create an index on event_type for better querying
CREATE INDEX IF NOT EXISTS idx_user_activity_events_event_type ON public.user_activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_events_created_at ON public.user_activity_events(created_at);
