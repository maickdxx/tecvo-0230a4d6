-- Allow NULL user_id for anonymous events
ALTER TABLE public.user_activity_events 
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS for user_activity_events to allow anonymous inserts
-- Note: We only allow anonymous inserts, not selects.
DROP POLICY IF EXISTS "Users can insert own events" ON public.user_activity_events;
CREATE POLICY "Anyone can insert events"
  ON public.user_activity_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anonymous inserts for user_sessions (first visit)
ALTER TABLE public.user_sessions 
ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.user_sessions;
CREATE POLICY "Anyone can insert sessions"
  ON public.user_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);
