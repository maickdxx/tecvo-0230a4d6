
-- 1. Create user_sessions table
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0
);

-- 2. Create user_activity_events table
CREATE TABLE public.user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_started_at ON public.user_sessions(started_at);
CREATE INDEX idx_user_activity_events_user_id ON public.user_activity_events(user_id);
CREATE INDEX idx_user_activity_events_created_at ON public.user_activity_events(created_at);
CREATE INDEX idx_user_activity_events_event_type ON public.user_activity_events(event_type);

-- 4. Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for user_sessions
CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can select all sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6. RLS Policies for user_activity_events
CREATE POLICY "Users can insert own events"
  ON public.user_activity_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can select all events"
  ON public.user_activity_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 7. Create the engagement metrics RPC function
CREATE OR REPLACE FUNCTION public.get_user_engagement_metrics()
RETURNS TABLE (
  user_id UUID,
  avg_session_seconds NUMERIC,
  last_session_duration_seconds INTEGER,
  accesses_7d BIGINT,
  accesses_30d BIGINT,
  services_created_30d BIGINT,
  used_agenda BOOLEAN,
  used_finance BOOLEAN,
  used_weather_art BOOLEAN,
  has_any_action BOOLEAN,
  engagement_score INTEGER,
  engagement_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: requires super_admin role';
  END IF;

  RETURN QUERY
  WITH session_stats AS (
    SELECT
      s.user_id,
      COALESCE(AVG(s.duration_seconds) FILTER (WHERE s.started_at >= now() - interval '30 days'), 0) AS avg_sess,
      (SELECT s2.duration_seconds FROM public.user_sessions s2 WHERE s2.user_id = s.user_id ORDER BY s2.started_at DESC LIMIT 1) AS last_sess,
      COUNT(*) FILTER (WHERE s.started_at >= now() - interval '7 days') AS acc_7d,
      COUNT(*) FILTER (WHERE s.started_at >= now() - interval '30 days') AS acc_30d
    FROM public.user_sessions s
    GROUP BY s.user_id
  ),
  activity_stats AS (
    SELECT
      e.user_id,
      COUNT(*) FILTER (WHERE e.event_type = 'service_created' AND e.created_at >= now() - interval '30 days') AS svc_30d,
      bool_or(e.event_type = 'agenda_viewed' AND e.created_at >= now() - interval '30 days') AS agenda,
      bool_or(e.event_type = 'finance_viewed' AND e.created_at >= now() - interval '30 days') AS finance,
      bool_or(e.event_type = 'weather_art_generated' AND e.created_at >= now() - interval '30 days') AS weather,
      bool_or(e.created_at >= now() - interval '30 days') AS any_action
    FROM public.user_activity_events e
    GROUP BY e.user_id
  ),
  all_users AS (
    SELECT au.id AS uid FROM auth.users au
  ),
  scores AS (
    SELECT
      u.uid AS user_id,
      COALESCE(ss.avg_sess, 0) AS avg_session_seconds,
      COALESCE(ss.last_sess, 0) AS last_session_duration_seconds,
      COALESCE(ss.acc_7d, 0) AS accesses_7d,
      COALESCE(ss.acc_30d, 0) AS accesses_30d,
      COALESCE(a.svc_30d, 0) AS services_created_30d,
      COALESCE(a.agenda, false) AS used_agenda,
      COALESCE(a.finance, false) AS used_finance,
      COALESCE(a.weather, false) AS used_weather_art,
      COALESCE(a.any_action, false) AS has_any_action,
      -- Score calculation
      (
        -- Recency: days since last access via profiles.last_access
        CASE
          WHEN p.last_access IS NULL THEN 0
          WHEN p.last_access >= now() - interval '2 days' THEN 40
          WHEN p.last_access >= now() - interval '6 days' THEN 25
          WHEN p.last_access >= now() - interval '14 days' THEN 10
          ELSE 0
        END
        +
        -- Avg session duration
        CASE
          WHEN COALESCE(ss.avg_sess, 0) >= 120 THEN 20
          WHEN COALESCE(ss.avg_sess, 0) >= 30 THEN 10
          ELSE 0
        END
        +
        -- Frequency
        CASE
          WHEN COALESCE(ss.acc_7d, 0) >= 3 THEN 20
          WHEN COALESCE(ss.acc_7d, 0) >= 1 THEN 10
          ELSE 0
        END
        +
        -- Feature usage
        CASE
          WHEN (COALESCE(a.agenda, false)::int + COALESCE(a.finance, false)::int + COALESCE(a.weather, false)::int) >= 2 THEN 20
          WHEN (COALESCE(a.agenda, false)::int + COALESCE(a.finance, false)::int + COALESCE(a.weather, false)::int) >= 1 THEN 10
          ELSE 0
        END
      )::INTEGER AS engagement_score
    FROM all_users u
    LEFT JOIN session_stats ss ON ss.user_id = u.uid
    LEFT JOIN activity_stats a ON a.user_id = u.uid
    LEFT JOIN public.profiles p ON p.user_id = u.uid
  )
  SELECT
    sc.user_id,
    sc.avg_session_seconds,
    sc.last_session_duration_seconds,
    sc.accesses_7d,
    sc.accesses_30d,
    sc.services_created_30d,
    sc.used_agenda,
    sc.used_finance,
    sc.used_weather_art,
    sc.has_any_action,
    sc.engagement_score,
    CASE
      WHEN sc.engagement_score >= 60 THEN 'active'
      WHEN sc.engagement_score >= 30 THEN 'warm'
      ELSE 'risk'
    END AS engagement_level
  FROM scores sc;
END;
$$;
