-- 1. Add anonymous_id to user_sessions
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS anonymous_id UUID;
CREATE INDEX IF NOT EXISTS idx_user_sessions_anonymous_id ON public.user_sessions(anonymous_id);

-- Drop dependent views first
DROP VIEW IF EXISTS public.view_analytics_daily_metrics;
DROP VIEW IF EXISTS public.view_analytics_sessions;
DROP VIEW IF EXISTS public.view_analytics_marketing_funnel;
DROP VIEW IF EXISTS public.view_analytics_lead_dropoffs;
DROP VIEW IF EXISTS public.view_analytics_lead_paths;

-- 2. Recreate view_analytics_sessions with anonymous_id
CREATE OR REPLACE VIEW public.view_analytics_sessions AS
SELECT
    id,
    user_id,
    anonymous_id,
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

-- 3. Recreate view_analytics_daily_metrics
CREATE OR REPLACE VIEW public.view_analytics_daily_metrics AS
WITH daily_sessions AS (
    SELECT 
        date_trunc('day', started_at)::date as day,
        COUNT(*) as total_sessions,
        COUNT(DISTINCT COALESCE(user_id::text, anonymous_id::text)) as unique_visitors,
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

-- 4. Recreate marketing funnel view
CREATE OR REPLACE VIEW public.view_analytics_marketing_funnel AS
WITH marketing_events AS (
  SELECT 
    COALESCE(user_id::text, metadata->>'anonymous_id') as visitor_id,
    event_type,
    created_at,
    metadata->>'page_path' as page_path
  FROM user_activity_events
  WHERE COALESCE(user_id::text, metadata->>'anonymous_id') IS NOT NULL
),
funnel_steps AS (
  SELECT
    visitor_id,
    MIN(created_at) FILTER (WHERE event_type IN ('page_view', 'landing_page_view')) as step_1_visit,
    MIN(created_at) FILTER (WHERE event_type = 'interaction') as step_2_interaction,
    MIN(created_at) FILTER (WHERE event_type = 'create_account_click') as step_3_cta_click,
    MIN(created_at) FILTER (WHERE event_type = 'signup_started') as step_4_signup_started,
    MIN(created_at) FILTER (WHERE event_type = 'signup_completed') as step_5_signup_completed,
    MIN(created_at) FILTER (WHERE event_type = 'payment_initiated') as step_6_payment_initiated,
    MIN(created_at) FILTER (WHERE event_type = 'payment_completed') as step_7_payment_completed
  FROM marketing_events
  GROUP BY visitor_id
)
SELECT
  COUNT(DISTINCT visitor_id) as total_visitors,
  COUNT(step_1_visit) as landing_page_views,
  COUNT(step_2_interaction) as interactions,
  COUNT(step_3_cta_click) as cta_clicks,
  COUNT(step_4_signup_started) as signups_started,
  COUNT(step_5_signup_completed) as signups_completed,
  COUNT(step_6_payment_initiated) as payments_initiated,
  COUNT(step_7_payment_completed) as payments_completed,
  CASE WHEN COUNT(step_1_visit) > 0 THEN (COUNT(step_3_cta_click)::float / COUNT(step_1_visit)) * 100 ELSE 0 END as cta_click_rate,
  CASE WHEN COUNT(step_1_visit) > 0 THEN (COUNT(step_4_signup_started)::float / COUNT(step_1_visit)) * 100 ELSE 0 END as signup_start_rate,
  CASE WHEN COUNT(step_4_signup_started) > 0 THEN (COUNT(step_5_signup_completed)::float / COUNT(step_4_signup_started)) * 100 ELSE 0 END as signup_completion_rate,
  CASE WHEN COUNT(step_1_visit) > 0 THEN (COUNT(step_7_payment_completed)::float / COUNT(step_1_visit)) * 100 ELSE 0 END as final_conversion_rate,
  AVG(EXTRACT(EPOCH FROM (step_5_signup_completed - step_1_visit))) FILTER (WHERE step_5_signup_completed IS NOT NULL) as avg_time_to_signup_seconds
FROM funnel_steps;

-- 5. Recreate lead dropoffs view
CREATE OR REPLACE VIEW view_analytics_lead_dropoffs AS
WITH visitor_last_page AS (
  SELECT 
    COALESCE(e.user_id::text, e.metadata->>'anonymous_id') as visitor_id,
    e.metadata->>'page_path' as last_page,
    e.created_at as last_at,
    ROW_NUMBER() OVER(PARTITION BY COALESCE(e.user_id::text, e.metadata->>'anonymous_id') ORDER BY e.created_at DESC) as rank
  FROM user_activity_events e
  WHERE e.event_type IN ('page_view', 'landing_page_view')
  AND COALESCE(e.user_id::text, e.metadata->>'anonymous_id') IS NOT NULL
),
converted_visitors AS (
  SELECT DISTINCT COALESCE(user_id::text, metadata->>'anonymous_id') as visitor_id
  FROM user_activity_events
  WHERE event_type = 'payment_completed' OR event_type = 'signup_completed'
)
SELECT 
  last_page,
  COUNT(*) as dropoff_count
FROM visitor_last_page v
WHERE rank = 1
AND visitor_id NOT IN (SELECT visitor_id FROM converted_visitors)
GROUP BY last_page
ORDER BY dropoff_count DESC;

-- 6. Recreate lead paths view
CREATE OR REPLACE VIEW view_analytics_lead_paths AS
SELECT 
  visitor_id,
  string_agg(event_type, ' -> ' ORDER BY created_at) as path,
  COUNT(*) as interaction_count,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as total_time_seconds
FROM (
  SELECT 
    COALESCE(user_id::text, metadata->>'anonymous_id') as visitor_id,
    event_type,
    created_at
  FROM user_activity_events
  WHERE event_type != 'interaction'
  AND COALESCE(user_id::text, metadata->>'anonymous_id') IS NOT NULL
) sub
GROUP BY visitor_id
LIMIT 100;