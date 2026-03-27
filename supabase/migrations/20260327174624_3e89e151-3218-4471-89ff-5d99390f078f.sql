-- 1. Analytics Views

-- View for sessions with duration and UTMs
CREATE OR REPLACE VIEW public.view_analytics_sessions AS
SELECT
    id,
    user_id,
    organization_id,
    started_at,
    ended_at,
    duration_seconds,
    utm_source,
    utm_medium,
    utm_campaign,
    referrer,
    landing_page,
    CASE
        WHEN user_id IS NULL THEN 'anonymous'
        ELSE 'authenticated'
    END as user_status
FROM public.user_sessions;

-- View for events with metadata decomposition (if needed)
CREATE OR REPLACE VIEW public.view_analytics_events AS
SELECT
    id,
    user_id,
    organization_id,
    event_type,
    created_at,
    metadata->>'page_path' as page_path,
    metadata->>'page_title' as page_title,
    metadata->>'utm_source' as utm_source,
    metadata->>'utm_medium' as utm_medium,
    metadata->>'utm_campaign' as utm_campaign,
    (metadata->>'duration_on_previous_page')::int as duration_on_previous_page,
    metadata
FROM public.user_activity_events;

-- Daily metrics view
CREATE OR REPLACE VIEW public.view_analytics_daily_metrics AS
WITH daily_sessions AS (
    SELECT 
        date_trunc('day', started_at)::date as day,
        COUNT(*) as total_sessions,
        COUNT(DISTINCT COALESCE(user_id::text, id::text)) as unique_visitors,
        AVG(duration_seconds) as avg_duration_seconds
    FROM public.user_sessions
    GROUP BY 1
),
daily_events AS (
    SELECT
        date_trunc('day', created_at)::date as day,
        COUNT(*) FILTER (WHERE event_type = 'signup_started') as signups_started,
        COUNT(*) FILTER (WHERE event_type = 'signup_completed') as signups_completed,
        COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views
    FROM public.user_activity_events
    GROUP BY 1
)
SELECT
    s.day,
    s.total_sessions,
    s.unique_visitors,
    COALESCE(s.avg_duration_seconds, 0) as avg_session_duration,
    COALESCE(e.signups_started, 0) as signups_started,
    COALESCE(e.signups_completed, 0) as signups_completed,
    COALESCE(e.page_views, 0) as page_views,
    CASE 
        WHEN s.unique_visitors > 0 THEN (COALESCE(e.signups_completed, 0)::float / s.unique_visitors::float) * 100
        ELSE 0 
    END as conversion_rate
FROM daily_sessions s
LEFT JOIN daily_events e ON s.day = e.day;

-- Traffic sources view
CREATE OR REPLACE VIEW public.view_analytics_traffic_sources AS
SELECT
    COALESCE(utm_source, 'direct') as source,
    COALESCE(utm_medium, 'none') as medium,
    COALESCE(utm_campaign, 'none') as campaign,
    COUNT(*) as session_count,
    COUNT(DISTINCT user_id) as user_count
FROM public.user_sessions
GROUP BY 1, 2, 3;

-- Page views analytics view
CREATE OR REPLACE VIEW public.view_analytics_pages AS
SELECT
    metadata->>'page_path' as page_path,
    metadata->>'page_title' as page_title,
    COUNT(*) as total_views,
    COUNT(DISTINCT COALESCE(user_id::text, id::text)) as unique_views,
    AVG((metadata->>'duration_on_previous_page')::int) as avg_duration_on_page
FROM public.user_activity_events
WHERE event_type = 'page_view'
GROUP BY 1, 2;

-- 2. RLS for Views (Postgres views don't have RLS, but the underlying tables do. 
-- However, we can use security definer functions if we want to expose them via API safely, 
-- or just rely on the fact that super admins have bypass or appropriate policies.)

-- Ensure Super Admins can see the data in the underlying tables (already done in migration 20260227193137)

-- Add a column to profiles to store UTMs from landing if not already there (for persistence check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'initial_utm_source') THEN
        ALTER TABLE public.profiles ADD COLUMN initial_utm_source TEXT;
        ALTER TABLE public.profiles ADD COLUMN initial_utm_medium TEXT;
        ALTER TABLE public.profiles ADD COLUMN initial_utm_campaign TEXT;
        ALTER TABLE public.profiles ADD COLUMN initial_referrer TEXT;
        ALTER TABLE public.profiles ADD COLUMN initial_landing_page TEXT;
    END IF;
END $$;